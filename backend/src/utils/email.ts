import { resend, EMAIL_FROM } from '../config/email';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (data: EmailData): Promise<boolean> => {
  if (!resend) {
    console.warn('Email service not configured. Skipping email send.');
    return false;
  }

  try {
    const { data: emailData, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: data.subject,
      html: data.html,
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    console.log('Email sent successfully:', emailData);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

export const sendInvitationEmail = async (to: string, organizationName: string, token: string): Promise<boolean> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const acceptUrl = `${frontendUrl}/accept-invitation?token=${token}`;

  return sendEmail({
    to,
    subject: `Invitation to join ${organizationName}`,
    html: `
      <h2>You've been invited to join ${organizationName}</h2>
      <p>You have been invited to join the organization on our platform.</p>
      <p><a href="${acceptUrl}">Click here to accept the invitation</a></p>
      <p>This link will expire in 7 days.</p>
    `,
  });
};

export const sendPaymentSuccessEmail = async (to: string, organizationName: string, amount: number): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Payment Successful',
    html: `
      <h2>Payment Successful</h2>
      <p>Your payment of $${amount.toFixed(2)} for ${organizationName} was successful.</p>
      <p>Thank you for your subscription!</p>
    `,
  });
};

export const sendPaymentFailedEmail = async (to: string, organizationName: string): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Payment Failed',
    html: `
      <h2>Payment Failed</h2>
      <p>Your payment for ${organizationName} could not be processed.</p>
      <p>Please try again or contact support if the issue persists.</p>
    `,
  });
};

export const sendSubscriptionUpgradedEmail = async (to: string, planName: string): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Subscription Upgraded',
    html: `
      <h2>Subscription Upgraded</h2>
      <p>Your subscription has been successfully upgraded to ${planName}.</p>
      <p>Thank you for your continued subscription!</p>
    `,
  });
};

export const sendSubscriptionDowngradedEmail = async (to: string, planName: string): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Subscription Downgraded',
    html: `
      <h2>Subscription Downgraded</h2>
      <p>Your subscription has been changed to ${planName}.</p>
      <p>The changes will take effect at the end of your current billing period.</p>
    `,
  });
};

export const sendSubscriptionCancelledEmail = async (to: string): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Subscription Cancelled',
    html: `
      <h2>Subscription Cancelled</h2>
      <p>Your subscription has been cancelled.</p>
      <p>You will continue to have access until the end of your current billing period.</p>
      <p>We're sorry to see you go!</p>
    `,
  });
};

export const sendSubscriptionExpiringEmail = async (to: string, expiryDate: Date): Promise<boolean> => {
  const formattedDate = expiryDate.toLocaleDateString();

  return sendEmail({
    to,
    subject: 'Subscription Expiring Soon',
    html: `
      <h2>Subscription Expiring Soon</h2>
      <p>Your subscription will expire on ${formattedDate}.</p>
      <p>Please renew your subscription to continue using the service.</p>
    `,
  });
};
