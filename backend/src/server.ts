import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalRateLimiter } from './middleware/rateLimit';

// Import repositories
import * as repositories from './repositories';

// Import services
import * as services from './services';

// Import controllers
import * as controllers from './controllers';

// Import routes
import * as routes from './routes';

const PORT = process.env.PORT || 5000;

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
app.use(generalRateLimiter);

// Body parsing middleware - preserves raw buffer on req.rawBody for Stripe signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Initialize repositories
const userRepository = new repositories.UserRepository();
const organizationRepository = new repositories.OrganizationRepository();
const planRepository = new repositories.PlanRepository();
const subscriptionRepository = new repositories.SubscriptionRepository();
const paymentRepository = new repositories.PaymentRepository();
const transactionRepository = new repositories.TransactionRepository();
const invitationRepository = new repositories.InvitationRepository();
const passwordResetTokenRepository = new repositories.PasswordResetTokenRepository();
const webhookEventRepository = new repositories.WebhookEventRepository();
const pendingRegistrationRepository = new repositories.PendingRegistrationRepository();

// Initialize services
const authService = new services.AuthService(
  userRepository,
  passwordResetTokenRepository,
  pendingRegistrationRepository,
  planRepository,
  undefined,
  organizationRepository
);
const organizationService = new services.OrganizationService(
  organizationRepository,
  userRepository,
  subscriptionRepository,
  paymentRepository,
  transactionRepository
);
const planService = new services.PlanService(planRepository);
const subscriptionService = new services.SubscriptionService(
  subscriptionRepository,
  planRepository,
  userRepository,
  organizationRepository
);
const paymentService = new services.PaymentService(
  paymentRepository,
  subscriptionRepository,
  planRepository,
  organizationRepository
);
const transactionService = new services.TransactionService(transactionRepository, paymentRepository);
const memberService = new services.MemberService(userRepository, invitationRepository, organizationRepository);
const webhookService = new services.WebhookService(
  webhookEventRepository,
  organizationRepository,
  userRepository,
  subscriptionRepository,
  paymentRepository,
  transactionRepository,
  pendingRegistrationRepository,
  planRepository
);
authService.setWebhookService(webhookService);

// Initialize controllers
const authController = new controllers.AuthController(authService);
const organizationController = new controllers.OrganizationController(organizationService);
const planController = new controllers.PlanController(planService);
const subscriptionController = new controllers.SubscriptionController(subscriptionService);
const paymentController = new controllers.PaymentController(paymentService);
const transactionController = new controllers.TransactionController(transactionService);
const memberController = new controllers.MemberController(memberService);
const webhookController = new controllers.WebhookController(webhookService);

// Initialize routes
app.use('/api/auth', routes.createAuthRoutes(authController));
app.post('/api/auth/accept-invitation', memberController.acceptInvitation);
app.use('/api/organizations', routes.createOrganizationRoutes(organizationController));
app.use('/api/plans', routes.createPlanRoutes(planController));
app.use('/api/subscriptions', routes.createSubscriptionRoutes(subscriptionController));
app.use('/api/payments', routes.createPaymentRoutes(paymentController));
app.use('/api/transactions', routes.createTransactionRoutes(transactionController));
app.use('/api/members', routes.createMemberRoutes(memberController));
app.use('/api/webhooks', routes.createWebhookRoutes(webhookController));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Scheduled job: check expiring subscriptions once every 24 hours
const startScheduledJobs = () => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('[Scheduler] Running daily expiring subscription check...');
      const sent = await subscriptionService.checkExpiringSubscriptions();
      console.log(`[Scheduler] Expiring subscription check complete. Reminders sent: ${sent}`);
    } catch (err: any) {
      console.error('[Scheduler] Error checking expiring subscriptions:', err.message);
    }
  }, TWENTY_FOUR_HOURS);
};

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      startScheduledJobs();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(`Failed to start server: ${message}`);
    process.exit(1);
  }
};

// Start the HTTP listener only when this file is the process entrypoint. This keeps
// imports side-effect free for tests and other tooling that need the Express app.
if (require.main === module) {
  startServer();
}

export default app;
