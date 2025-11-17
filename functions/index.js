const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference } = require("mercadopago");

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });

exports.createPayment = onCall({ 
  secrets: ["MERCADOPAGO_ACCESS_TOKEN"],
  cors: true 
}, async (request) => {
    
    console.log("--- INICIANDO CREATE PAYMENT ---");

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não logado.");
    }

    // Recebe dados
    const { title, price, appointmentData } = request.data;
    console.log("Dados recebidos:", { title, price, appointmentData });

    const shopId = appointmentData.barbershopId;
    let shopAccessToken = null;

    try {
        // 1. Buscar Token
        const db = admin.firestore();
        const keysDoc = await db.doc(`barbershops/${shopId}/private/keys`).get();

        if (keysDoc.exists && keysDoc.data().accessToken) {
            shopAccessToken = keysDoc.data().accessToken.trim(); // .trim() remove espaços extras!
            console.log("Usando Token da Loja (Admin Panel)");
        } else {
            console.log("Token da Loja não encontrado, tentando fallback...");
            shopAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        }

        if (!shopAccessToken) {
             throw new HttpsError("failed-precondition", "Token de pagamento não configurado.");
        }

        // 2. Configurar Mercado Pago
        const client = new MercadoPagoConfig({
          accessToken: shopAccessToken
        });

        const preference = new Preference(client);
      
        // 3. Validar e Formatar Preço
        const cleanPrice = parseFloat(price);
        if (isNaN(cleanPrice)) {
             throw new Error(`Preço inválido: ${price}`);
        }

        const body = {
          items: [
            {
              id: "agendamento-servico",
              title: title || "Serviço de Barbearia",
              quantity: 1,
              unit_price: cleanPrice,
              currency_id: "BRL",
            },
          ],
          metadata: {
            // ... (mantenha o metadata como está) ...
            client_id: request.auth.uid,
            barbershop_id: appointmentData.barbershopId,
            service_id: appointmentData.serviceId,
            professional_id: appointmentData.professionalId
          },
          back_urls: {
            success: "http://localhost:5173/?status=success", 
            failure: "http://localhost:5173/?status=failure",
            pending: "http://localhost:5173/?status=pending",
          },
          // REMOVA ou COMENTE esta linha por enquanto:
          // auto_return: "approved", 
        };

        console.log("Enviando preferência para o Mercado Pago:", JSON.stringify(body));

        const result = await preference.create({ body });
        
        console.log("Sucesso! Link gerado:", result.init_point);
        return { paymentUrl: result.init_point };

    } catch (error) {
      console.error("ERRO CRÍTICO NO BACKEND:", error);
      // Retorna a mensagem real do erro para o front-end
      throw new HttpsError("internal", `Erro MP: ${error.message}`);
    }
});