const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });
const db = admin.firestore();

// --- Helpers (Mesma lógica que estava no Front) ---
const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// --- Função Exportada: Calcular Slots Disponíveis ---
exports.getAvailableSlots = onCall(async (request) => {
  const { professionalId, date, serviceDuration, barbershopId } = request.data;

  if (!professionalId || !date || !serviceDuration) {
    throw new HttpsError('invalid-argument', 'Dados incompletos para cálculo.');
  }

  try {
    const selectedDate = new Date(date);
    const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];

    // 1. Buscar Horário de Trabalho
    const workHoursDoc = await db.collection('professionals').doc(professionalId)
      .collection('workingHours').doc(dayKey).get();

    if (!workHoursDoc.exists || !workHoursDoc.data().isWorking) {
      return { slots: [] }; // Não trabalha hoje
    }

    const { startTime, endTime } = workHoursDoc.data();
    
    // 2. Buscar Agendamentos Existentes (Admin SDK ignora regras de segurança, o que é ótimo aqui)
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const appointmentsSnapshot = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();

    const bookedSlots = [];
    appointmentsSnapshot.forEach(doc => {
        const data = doc.data();
        // Ignora cancelados
        if (!['cancelled_by_client', 'cancelled_by_pro'].includes(data.status)) {
            // Precisamos bloquear todo o intervalo do serviço agendado
            const appStart = data.startTime.toDate();
            const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
            
            // Se não tiver duração salva, assume a duração do serviço atual (fallback)
            // Idealmente, seus appointments devem salvar a duração do serviço na criação
            // Vamos simplificar e bloquear apenas o slot de início por enquanto, 
            // mas para produção robusta, você deve calcular o intervalo (start -> end)
            bookedSlots.push(minutesToTime(appStartMinutes)); 
            
            // Lógica avançada: Adicionar todos os slots cobertos por este agendamento à lista de bloqueados
            // (Deixaremos simples para este MVP, bloqueando o horário de início)
        }
    });

    // 3. Buscar Bloqueios Manuais
    const blocksRef = db.collection('professionals').doc(professionalId).collection('blockedTimes');
    
    const recurringSnap = await blocksRef.where('type', '==', 'recurring').where('dayOfWeek', '==', dayKey).get();
    const singleSnap = await blocksRef.where('type', '==', 'single').where('date', '==', admin.firestore.Timestamp.fromDate(startOfDay)).get();

    const blockedPeriods = [];
    const processBlock = (doc) => blockedPeriods.push(doc.data());
    recurringSnap.forEach(processBlock);
    singleSnap.forEach(processBlock);

    // 4. Gerar Slots Livres
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const duration = parseInt(serviceDuration);
    
    const availableSlots = [];

    for (let time = startMinutes; time < endMinutes; time += duration) {
      const slotStart = time;
      const slotEnd = time + duration;
      
      if (slotEnd > endMinutes) break;

      const slotString = minutesToTime(slotStart);

      // Verifica colisão com agendamentos
      if (bookedSlots.includes(slotString)) continue;

      // Verifica colisão com bloqueios
      let isBlocked = false;
      for (const block of blockedPeriods) {
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        // Se o slot se sobrepõe ao bloqueio
        if (slotStart < blockEnd && slotEnd > blockStart) {
          isBlocked = true;
          break;
        }
      }

      if (!isBlocked) {
        availableSlots.push(slotString);
      }
    }

    return { slots: availableSlots };

  } catch (error) {
    console.error("Erro no cálculo de slots:", error);
    throw new HttpsError('internal', 'Erro ao calcular horários disponíveis.');
  }
});


// --- FUNÇÃO 1: CRIAR PAGAMENTO (Gerar Link) ---
exports.createPayment = onCall({ 
  secrets: ["MERCADOPAGO_ACCESS_TOKEN"],
  cors: true 
}, async (request) => {
    
    if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");

    // Recebe dados (incluindo o appointmentId que criamos no ClientPanel)
    const { title, price, appointmentId, appointmentData } = request.data;
    const shopId = appointmentData.barbershopId;
    let shopAccessToken = null;

    try {
        // 1. Buscar Token da Loja
        const db = admin.firestore();
        const keysDoc = await db.doc(`barbershops/${shopId}/private/keys`).get();

        if (keysDoc.exists && keysDoc.data().accessToken) {
            shopAccessToken = keysDoc.data().accessToken.trim();
        } else {
            // Fallback para a chave da plataforma (se não tiver na loja)
            shopAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        }

        if (!shopAccessToken) throw new HttpsError("failed-precondition", "Token não configurado.");

        const client = new MercadoPagoConfig({ accessToken: shopAccessToken });
        const preference = new Preference(client);

        // 2. Construir a URL do Webhook (A MÁGICA)
        // O Firebase preenche GCLOUD_PROJECT automaticamente com o ID do seu projeto
        const projectId = process.env.GCLOUD_PROJECT || "agenda-barbearia-8c8d8";
        const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/paymentWebhook?shopId=${shopId}`;

        console.log("URL de Notificação configurada:", webhookUrl);

        const result = await preference.create({
            body: {
              items: [
                {
                  id: appointmentId, // Enviamos o ID do agendamento para recuperar depois
                  title: title,
                  quantity: 1,
                  unit_price: parseFloat(price),
                  currency_id: "BRL",
                },
              ],
              metadata: {
                appointment_id: appointmentId,
                shop_id: shopId
              },
              back_urls: {
                success: "http://localhost:5173/?status=success",
                failure: "http://localhost:5173/?status=failure",
                pending: "http://localhost:5173/?status=pending",
              },
              // Deixamos auto_return comentado para evitar o erro 500 no localhost
              // auto_return: "approved",
              
              // AQUI ESTÁ A LIGAÇÃO DO WEBHOOK:
              notification_url: webhookUrl 
            }
        });

        return { paymentUrl: result.init_point };

    } catch (error) {
      console.error("Erro createPayment:", error);
      throw new HttpsError("internal", error.message);
    }
});

// --- FUNÇÃO 2: WEBHOOK (Receber Aviso) ---
exports.paymentWebhook = onRequest({
    secrets: ["MERCADOPAGO_ACCESS_TOKEN"],
    cors: true
}, async (req, res) => {
    // O Mercado Pago envia o ID da loja que passamos na URL acima
    const { shopId } = req.query; 
    
    // O Mercado Pago manda os dados no corpo ou na query, dependendo do tipo
    const topic = req.body.type || req.body.topic || req.query.topic;
    const id = req.body.data?.id || req.body.id || req.query.id;

    console.log(`🔔 Webhook recebido! Tópico: ${topic}, ID: ${id}, Loja: ${shopId}`);

    if (topic === "payment" && id && shopId) {
        try {
            // 1. Buscar o Token da Loja Específica (igual fizemos no createPayment)
            const db = admin.firestore();
            const keysDoc = await db.doc(`barbershops/${shopId}/private/keys`).get();
            let shopAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
            
            if (keysDoc.exists && keysDoc.data().accessToken) {
                shopAccessToken = keysDoc.data().accessToken.trim();
            }

            // 2. Perguntar ao Mercado Pago: "Esse pagamento foi aprovado mesmo?"
            const client = new MercadoPagoConfig({ accessToken: shopAccessToken });
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: id });

            const status = paymentInfo.status; // approved, pending, rejected, etc.
            
            // Recupera o ID do agendamento que escondemos no metadata ou no item
            const appointmentId = paymentInfo.metadata?.appointment_id || paymentInfo.additional_info?.items?.[0]?.id;

            console.log(`🔎 Pagamento ${id} verificado. Status: ${status}. Agendamento: ${appointmentId}`);

            // 3. Se APROVADO, atualiza o Firestore
            if (status === 'approved' && appointmentId) {
                await db.doc(`appointments/${appointmentId}`).update({
                    status: 'confirmed',     // O sistema libera o horário
                    paymentStatus: 'paid',   // Marca como pago
                    paymentId: id,           // Salva o ID da transação
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Agendamento ${appointmentId} CONFIRMADO via Webhook!`);
            }

        } catch (error) {
            console.error("❌ Erro processando Webhook:", error);
        }
    }

    // Sempre responder 200 OK rápido, senão o Mercado Pago continua mandando
    res.status(200).send("OK");
});