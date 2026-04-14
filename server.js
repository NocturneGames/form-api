const express = require("express");
const app = express();
app.use(express.json());

const NOTION_KEY = process.env.NOTION_KEY;
const DB_ID = process.env.DB_ID;
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
  const { appLink, about, howHeard, publisher } = req.body || {};

  if (!appLink) return res.status(400).json({ ok: false, error: "App link required" });

  const appName = appLink.replace(/https?:\/\//, "").split("/")[0];

  const payload = {
    parent: { database_id: DB_ID },
    properties: {
      Name: { title: [{ text: { content: appName } }] },
      "App Store Link": { url: appLink },
      "About": { rich_text: [{ text: { content: about || "" } }] },
      "How did you hear about Nocturne?": { rich_text: [{ text: { content: howHeard || "" } }] },
      "Worked with a publisher before?": { rich_text: [{ text: { content: publisher || "" } }] },
      "Submitted at": { date: { start: new Date().toISOString() } },
    },
  };

  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("Notion error:", err);
      return res.status(500).json({ ok: false, error: "Notion error" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
