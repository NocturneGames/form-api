const express = require("express");
const app = express();
app.use(express.json());

const NOTION_KEY   = process.env.NOTION_KEY;
const DB_ID        = process.env.DB_ID;
const RESEND_KEY   = process.env.RESEND_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || "noreply@nocturne.build";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://nocturne.build";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (req, res) => res.json({ ok: true }));

app.post("/apply", async (req, res) => {
  const { fullName, email, appLink, about, howHeard, publisher } = req.body || {};

  if (!appLink) return res.status(400).json({ ok: false, error: "App link required" });
  if (!email)   return res.status(400).json({ ok: false, error: "Email required" });

  const appName = appLink.replace(/https?:\/\//, "").split("/")[0];

  // 1. Write to Notion
  const notionPayload = {
    parent: { database_id: DB_ID },
    properties: {
      Name:      { title: [{ text: { content: fullName || appName } }] },
      "Full Name": { rich_text: [{ text: { content: fullName || "" } }] },
      "Email":   { email: email },
      "App Store Link": { url: appLink },
      "About":   { rich_text: [{ text: { content: about || "" } }] },
      "How did you hear about Nocturne?": { rich_text: [{ text: { content: howHeard || "" } }] },
      "Worked with a publisher before?":  { rich_text: [{ text: { content: publisher || "" } }] },
      "Submitted at": { date: { start: new Date().toISOString() } },
    },
  };

  try {
    const nr = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notionPayload),
    });

    if (!nr.ok) {
      const err = await nr.text();
      console.error("Notion error:", err);
      return res.status(500).json({ ok: false, error: "Notion error" });
    }
  } catch (err) {
    console.error("Notion fetch error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }

  // 2. Send confirmation email via Resend
  const firstName = (fullName || "").split(" ")[0] || "there";
  const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="background:#0a0a0a;color:#fdfbf5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:40px 24px;max-width:520px;margin:0 auto;">
  <img src="https://nocturne.build/assets/logo.png" alt="Nocturne" style="width:36px;height:36px;border-radius:8px;margin-bottom:24px;display:block;"/>
  <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 12px;">Application received.</h1>
  <p style="color:#999;font-size:0.9rem;line-height:1.6;margin:0 0 24px;">
    Hi ${firstName},<br/><br/>
    We got your application for <strong style="color:#fdfbf5;">${appLink}</strong>.<br/>
    We review every submission carefully. You'll hear from us within a few days.
  </p>
  <p style="color:#999;font-size:0.9rem;line-height:1.6;margin:0 0 32px;">
    In the meantime, if you have questions, reply to this email or
    <a href="https://arnaud.nocturne.build" style="color:#fdfbf5;">book a call with Arnaud directly</a>.
  </p>
  <hr style="border:none;border-top:1px solid #1c1c1c;margin:0 0 24px;"/>
  <p style="color:#444;font-size:0.78rem;margin:0;">Nocturne Games &mdash; nocturne.build</p>
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Nocturne Games <${FROM_EMAIL}>`,
        to: [email],
        subject: "We got your application.",
        html: emailBody,
      }),
    });
  } catch (err) {
    console.error("Resend error (non-blocking):", err);
    // Don't fail the request if email fails
  }

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
