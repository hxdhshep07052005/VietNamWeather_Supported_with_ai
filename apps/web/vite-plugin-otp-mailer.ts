import type { Plugin } from "vite";
import net from "node:net";

interface OtpEntry {
  code: string;
  email: string;
  type: "register" | "forgot-password";
  expiresAt: number;
}

const otpStore = new Map<string, OtpEntry>();

/**
 * Send OTP email via local SMTP (Mailpit on port 1025)
 */
function sendSmtpEmail({
  to,
  code,
  type = "register",
  smtpHost = "127.0.0.1",
  smtpPort = 1025,
}: {
  to: string;
  code: string;
  type?: "register" | "forgot-password";
  smtpHost?: string;
  smtpPort?: number;
}): Promise<{ success: boolean; id?: string }> {
  return new Promise((resolve) => {
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
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #071328; color: #FFFFFF;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #071328; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0F172A; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden;">
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
          <tr>
            <td style="padding: 35px 30px 25px;">
              <h2 style="margin: 0 0 15px; font-size: 18px; color: #FFFFFF; font-weight: 700;">
                ${title}
              </h2>
              <p style="margin: 0 0 25px; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
                ${subtitle}
              </p>
              <div style="background: rgba(255, 255, 255, 0.05); border: 2px dashed #FFCD00; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #FFCD00; font-weight: 700; margin-bottom: 8px;">
                  MÃ XÁC THỰC OTP (HẾT HẠN TRONG 5 PHÚT)
                </div>
                <div style="font-family: monospace, Consolas, Courier; font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #FFCD00; padding-left: 12px;">
                  ${code}
                </div>
              </div>
              <p style="margin: 25px 0 0; font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.6);">
                🔒 <strong>Lưu ý bảo mật:</strong> Không chia sẻ mã này cho bất kỳ ai. Đội ngũ VietnamWeather AI không bao giờ yêu cầu bạn cung cấp mã OTP.
              </p>
            </td>
          </tr>
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
          resolve({ success: true });
        }
      });

      socket.on("error", (err) => {
        console.warn(`[Mailer Warning] Không thể kết nối SMTP port ${smtpPort}:`, err.message);
        resolve({ success: false });
      });
    });

    socket.setTimeout(4000, () => {
      socket.destroy();
      resolve({ success: false });
    });
  });
}

function parseJsonBody(req: import("http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function otpMailerPlugin(): Plugin {
  return {
    name: "vite-plugin-otp-mailer",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/mailer/")) {
          return next();
        }

        res.setHeader("Content-Type", "application/json");

        // Route: POST /api/mailer/send-otp
        if (req.url === "/api/mailer/send-otp" && req.method === "POST") {
          const body = await parseJsonBody(req);
          const email = String(body.email || "").trim().toLowerCase();
          const type = (body.type === "forgot-password" ? "forgot-password" : "register") as "register" | "forgot-password";

          if (!email || !email.includes("@")) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, message: "Email không hợp lệ" }));
            return;
          }

          // Generate clean 6-digit OTP
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

          otpStore.set(email, { code, email, type, expiresAt });

          // Send via SMTP port 1025 (Mailpit)
          await sendSmtpEmail({ to: email, code, type });

          console.log(`\n===============================================================`);
          console.log(`📬 [VIETNAMWEATHER MAILER] ĐÃ GỬI MÃ OTP TỚI: ${email}`);
          console.log(`🔑 [MÃ OTP 6 SỐ]: ${code}`);
          console.log(`📋 [MỤC ĐÍCH]: ${type === "register" ? "Đăng ký tài khoản" : "Đặt lại mật khẩu"}`);
          console.log(`🌐 [XEM EMAIL TẠI HỘP THƯ TEST]: http://localhost:8025`);
          console.log(`===============================================================\n`);

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            message: `Mã xác thực 6 số đã được gửi tới ${email}`,
            email,
            code, // returned for dev convenience
            expiresAt,
            mailpitUrl: "http://localhost:8025",
          }));
          return;
        }

        // Route: POST /api/mailer/verify-otp
        if (req.url === "/api/mailer/verify-otp" && req.method === "POST") {
          const body = await parseJsonBody(req);
          const email = String(body.email || "").trim().toLowerCase();
          const code = String(body.code || "").trim();

          const record = otpStore.get(email);

          if (!record) {
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              message: "Chưa có mã xác thực nào được gửi tới email này. Vui lòng yêu cầu gửi lại mã.",
            }));
            return;
          }

          if (Date.now() > record.expiresAt) {
            otpStore.delete(email);
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              message: "Mã xác thực OTP đã hết hạn (quá 5 phút). Vui lòng nhấn gửi lại mã mới.",
            }));
            return;
          }

          if (record.code !== code) {
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              message: "Mã OTP 6 số không chính xác. Vui lòng kiểm tra lại trong hộp thư.",
            }));
            return;
          }

          // OTP verified successfully
          otpStore.delete(email);
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            message: "Xác thực mã OTP thành công!",
            verified: true,
            email,
          }));
          return;
        }

        // Route: POST /api/mailer/reset-password
        if (req.url === "/api/mailer/reset-password" && req.method === "POST") {
          const body = await parseJsonBody(req);
          const email = String(body.email || "").trim().toLowerCase();
          const code = String(body.code || "").trim();
          const newPassword = String(body.newPassword || "");

          const record = otpStore.get(email);

          if (!record || record.code !== code) {
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              message: "Mã OTP không hợp lệ hoặc đã hết hạn.",
            }));
            return;
          }

          if (newPassword.length < 8) {
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              message: "Mật khẩu mới phải có ít nhất 8 ký tự.",
            }));
            return;
          }

          otpStore.delete(email);
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.",
          }));
          return;
        }

        // Route: GET /api/mailer/latest
        if (req.url?.startsWith("/api/mailer/latest")) {
          const urlObj = new URL(req.url, "http://localhost:3000");
          const email = urlObj.searchParams.get("email")?.trim().toLowerCase();
          if (email && otpStore.has(email)) {
            const entry = otpStore.get(email)!;
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, email, code: entry.code, expiresAt: entry.expiresAt }));
            return;
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, message: "Không tìm thấy mã OTP" }));
          return;
        }

        next();
      });
    },
  };
}
