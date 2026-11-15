const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

const createTransporter = async () => {
  // If transporter already exists, return it
  if (transporter) {
    return transporter;
  }

  // For development/testing, use Ethereal Email (fake SMTP)
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    try {
      // Create a test account if credentials not provided
      if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASS) {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: process.env.ETHEREAL_USER,
            pass: process.env.ETHEREAL_PASS
          }
        });
      }
      return transporter;
    } catch (error) {
      throw new Error('Email service not configured. Please set SMTP_HOST or use Ethereal Email.');
    }
  }

  // Production SMTP configuration
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS in environment variables.');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

/**
 * Send password reset email
 * @param {string} email - User's email address
 * @param {string} resetToken - Password reset token
 * @param {string} username - User's username
 */
const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    const transporter = await createTransporter();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || `"MovieStream" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request - MovieStream',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #dc2626;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #dc2626;
              margin-bottom: 10px;
            }
            .content {
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #dc2626;
              color: #ffffff;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #b91c1c;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e5e5;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .warning {
              background-color: #fef2f2;
              border-left: 4px solid #dc2626;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .token {
              background-color: #f3f4f6;
              padding: 15px;
              border-radius: 4px;
              font-family: monospace;
              word-break: break-all;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎬 MovieStream</div>
              <h1>Password Reset Request</h1>
            </div>
            
            <div class="content">
              <p>Hello ${username || 'User'},</p>
              
              <p>We received a request to reset your password for your MovieStream account. If you made this request, please click the button below to reset your password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="token">${resetUrl}</div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
              </div>
              
              <p>For security reasons, this link can only be used once.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from MovieStream. Please do not reply to this email.</p>
              <p>If you have any questions, please contact our support team.</p>
              <p>&copy; ${new Date().getFullYear()} MovieStream. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - MovieStream
        
        Hello ${username || 'User'},
        
        We received a request to reset your password for your MovieStream account.
        
        Please click the following link to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        
        For security reasons, this link can only be used once.
        
        © ${new Date().getFullYear()} MovieStream. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    // In development with Ethereal, log the preview URL
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
      // Password reset email sent
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendPasswordResetEmail,
  createTransporter
};

