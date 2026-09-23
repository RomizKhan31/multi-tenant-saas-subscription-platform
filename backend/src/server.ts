import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
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

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
app.use(generalRateLimiter);

// Body parsing middleware
app.use(express.json());
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

// Initialize services
const authService = new services.AuthService(userRepository, passwordResetTokenRepository);
const organizationService = new services.OrganizationService(organizationRepository, userRepository);
const planService = new services.PlanService(planRepository);
const subscriptionService = new services.SubscriptionService(subscriptionRepository, planRepository);
const paymentService = new services.PaymentService(paymentRepository, subscriptionRepository);
const transactionService = new services.TransactionService(transactionRepository, paymentRepository);
const memberService = new services.MemberService(userRepository, invitationRepository);
const webhookService = new services.WebhookService(
  webhookEventRepository,
  organizationRepository,
  userRepository,
  subscriptionRepository,
  paymentRepository,
  transactionRepository
);

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

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
