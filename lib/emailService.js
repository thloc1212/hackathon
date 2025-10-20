import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn('Gmail credentials not configured. Email service will not work.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const senderName = process.env.GMAIL_SENDER_NAME || 'Hackathon App';
    console.log(`Email service initialized with Gmail account: ${process.env.GMAIL_USER}`);
    console.log(`Email sender name: "${senderName}"`);
  }

  generateOTP(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return otp;
  }

  async sendOTP(email, otp) {
    if (!this.transporter) {
      throw new Error('Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env file.');
    }

    // Get sender name from env or use default
    const senderName = process.env.GMAIL_SENDER_NAME || 'Hackathon App';
    const fromAddress = `"${senderName}" <${process.env.GMAIL_USER}>`;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: 'Your Login OTP Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #007bff;
              text-align: center;
              padding: 20px;
              margin: 20px 0;
              background-color: #f8f9fa;
              border-radius: 8px;
              letter-spacing: 5px;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .warning {
              color: #dc3545;
              font-size: 14px;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h2>Login Verification</h2>
              <p>Hello,</p>
              <p>You requested to log in to your account. Please use the following One-Time Password (OTP) to complete your login:</p>
              
              <div class="otp-code">${otp}</div>
              
              <p>This OTP is valid for <strong>10 minutes</strong>.</p>
              
              <p class="warning">⚠️ If you did not request this code, please ignore this email. Do not share this code with anyone.</p>
              
              <div class="footer">
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('OTP email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new Error('Failed to send OTP email. Please check your email configuration.');
    }
  }
}

export default new EmailService();
