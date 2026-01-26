import { Router } from "express";
import { commonAuthenticate } from "../../middleware/authenticate-routes.js";
import billingController from "../../controllers/billing.controller.js";

const router = Router();

// ========== PUBLIC ROUTES ==========

// Get credit configuration (min/max credits, price per credit)
router.get('/config', billingController.getConfigController);

// Razorpay webhook (no auth, signature verified in controller)
router.post('/webhook', billingController.webhookController);

// ========== PROTECTED ROUTES ==========
router.use(commonAuthenticate);

// Credit routes
router.get('/credits', billingController.getCreditsController);
router.post('/credits/purchase', billingController.purchaseCreditsController);
router.get('/credits/history', billingController.getCreditHistoryController);

// Payment verification
router.post('/verify-payment', billingController.verifyPaymentController);

export default router;
