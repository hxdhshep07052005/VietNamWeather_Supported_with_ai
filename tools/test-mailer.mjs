import net from "node:net";

/**
 * Send email via local Mailpit SMTP server (127.0.0.1:1025)
 */
export function sendOtpEmail({
  to,
  code,
  type = "register",
  smtpHost = "127.0.0.1",
  smtpPort = 1025,
}) {
  return new Promise((resolve, reject) => {
    const isRegister = type === "register";
    const subject = isRegister
      ? `[VietnamWeather AI] Mã xác thực OTP đăng ký: ${code}`
      : `[VietnamWeather AI] Mã xác thực đặt lại mật khẩu: ${code}`;

    const title = isRegister
      ? "Xác thực tài khoản VietnamWeather AI"
      : "Yêu cầu đặt lại mật khẩu";

    const subtitle = isRegister
      ? "Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhập mã 6 số dưới đây để kích hoạt tài khoản của bạn:"
      : "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhập mã 6 số dưới đây:";

    const htmlBody = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #071328; color: #FFFFFF;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #071328; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0F172A; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; background: linear-gradient(135deg, #0066CC 0%, #071328 100%); text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                VietnamWeather <span style="color: #FFCD00;">AI</span>
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.8);">
                Hệ thống Trợ lý Du lịch Thời tiết Thông minh Việt Nam
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 35px 30px 25px;">
              <h2 style="margin: 0 0 15px; font-size: 18px; color: #FFFFFF; font-weight: 700;">
                ${title}
              </h2>
              <p style="margin: 0 0 25px; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
                ${subtitle}
              </p>

              <!-- OTP Code Display Box -->
              <div style="background: rgba(255, 255, 255, 0.05); border: 2px dashed #FFCD00; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #FFCD00; font-weight: 700; margin-bottom: 8px;">
                  MÃ XÁC THỰC OTP (HẾT HẠN TRONG 5 PHÚT)
                </div>
                <div style="font-family: monospace, Consolas, Courier; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #FFCD00; padding-left: 12px;">
                  ${code}
                </div>
              </div>

              <p style="margin: 25px 0 0; font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.6);">
                🔒 <strong>Lưu ý bảo mật:</strong> Không chia sẻ mã xác thực này cho bất kỳ ai. Đội ngũ VietnamWeather AI không bao giờ yêu cầu cung cấp mã OTP của bạn.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5);">
                Email này được gửi tự động tới <strong>${to}</strong>.
              </p>
              <p style="margin: 4px 0 0; font-size: 11px; color: rgba(255, 255, 255, 0.4);">
                © 2026 VietnamWeather AI. Mọi quyền được bảo lưu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const socket = net.createConnection(smtpPort, smtpHost, () => {
      let state = "INIT";

      socket.on("data", (chunk) => {
        const text = chunk.toString();

        if (state === "INIT" && text.startsWith("220")) {
          state = "HELO";
          socket.write("HELO localhost\r\n");
        } else if (state === "HELO" && text.startsWith("250")) {
          state = "MAIL";
          socket.write("MAIL FROM:<no-reply@vietnamweather.vn>\r\n");
        } else if (state === "MAIL" && text.startsWith("250")) {
          state = "RCPT";
          socket.write(`RCPT TO:<${to}>\r\n`);
        } else if (state === "RCPT" && text.startsWith("250")) {
          state = "DATA";
          socket.write("DATA\r\n");
        } else if (state === "DATA" && text.startsWith("354")) {
          state = "CONTENT";
          const subjectBase64 = Buffer.from(subject).toString("base64");
          const htmlBase64 = Buffer.from(htmlBody).toString("base64");

          const headers = [
            "From: VietnamWeather AI <no-reply@vietnamweather.vn>",
            `To: <${to}>`,
            `Subject: =?UTF-8?B?${subjectBase64}?=`,
            "MIME-Version: 1.0",
            'Content-Type: text/html; charset="UTF-8"',
            "Content-Transfer-Encoding: base64",
            `Date: ${new Date().toUTCString()}`,
            "",
            htmlBase64,
            ".",
            ""
          ].join("\r\n");

          socket.write(headers);
        } else if (state === "CONTENT" && text.startsWith("250")) {
          state = "QUIT";
          socket.write("QUIT\r\n");
          resolve({
            success: true,
            to,
            code,
            subject,
            response: text.trim(),
            uiUrl: "http://localhost:8025",
          });
        }
      });

      socket.on("error", (err) => {
        reject(err);
      });
    });
  });
}

// If executed directly from CLI: node tools/test-mailer.mjs [email]
if (process.argv[1]?.endsWith("test-mailer.mjs")) {
  const targetEmail = process.argv[2] || "user.test@gmail.com";
  const sampleCode = Math.floor(100000 + Math.random() * 900000).toString();

  console.log(`\n======================================================`);
  console.log(`🚀 [MAILER TEST] Đang gửi OTP thử nghiệm tới: ${targetEmail}`);
  console.log(`🔑 [MÃ OTP 6 SỐ TẠO MỚI]: ${sampleCode}`);
  console.log(`🔌 [SMTP PORT]: 1025 | [WEB UI PORT]: 8025`);
  console.log(`======================================================\n`);

  sendOtpEmail({ to: targetEmail, code: sampleCode, type: "register" })
    .then((result) => {
      console.log(`✅ [THÀNH CÔNG] Đã gửi email thành công qua SMTP port 1025!`);
      console.log(`📬 [KIỂM TRA HỘP THƯ]: Mở trình duyệt tại http://localhost:8025`);
      console.log(`\nThông tin chi tiết:`, result);
    })
    .catch((err) => {
      console.error(`❌ [LỖI] Không thể gửi email qua SMTP:`, err);
    });
}
