/**
 * SMOKE TEST server — deploy this to Render FIRST, before building the real app.
 * Purpose: prove that Render's datacenter IP can reach Crunchyroll without being
 * blocked by Cloudflare bot management. Hit /probe and read the JSON verdict.
 *
 * Env (set in Render dashboard): BASIC_AUTH_TOKEN, REFRESH_TOKEN
 */
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/probe", async (_req, res) => {
  const out = { step: "start", cloudflareBlocked: false };
  try {
    // 1. auth
    const authRes = await fetch("https://www.crunchyroll.com/auth/v1/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${process.env.BASIC_AUTH_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.REFRESH_TOKEN }),
    });
    const authText = await authRes.text();
    out.authStatus = authRes.status;
    if (authText.includes("Just a moment") || authText.includes("cf-")) {
      out.cloudflareBlocked = true;
      out.verdict = "BLOCKED by Cloudflare at auth — Render will NOT work for this project.";
      return res.status(200).json(out);
    }
    if (!authRes.ok) { out.verdict = "Auth failed (not Cloudflare)."; out.body = authText.slice(0, 300); return res.json(out); }
    const { access_token } = JSON.parse(authText);
    out.step = "auth ok";

    // 2. one data request
    const dataRes = await fetch(
      "https://www.crunchyroll.com/content/v2/discover/browse?locale=th-TH&sort_by=newly_added&n=3",
      { headers: { Authorization: `Bearer ${access_token}`, "User-Agent": UA } },
    );
    const dataText = await dataRes.text();
    out.dataStatus = dataRes.status;
    if (dataText.includes("Just a moment")) {
      out.cloudflareBlocked = true;
      out.verdict = "Auth passed but DATA request BLOCKED by Cloudflare — Render will NOT work.";
      return res.json(out);
    }
    out.verdict = dataRes.ok ? "SUCCESS — Render CAN reach Crunchyroll. Safe to build the real app here." : "Data request failed (not Cloudflare).";
    out.dataPreview = dataText.slice(0, 200);
    res.json(out);
  } catch (err) {
    out.verdict = "Error"; out.error = String(err);
    res.status(500).json(out);
  }
});

app.listen(PORT, () => console.log(`smoke-test server on :${PORT}`));
