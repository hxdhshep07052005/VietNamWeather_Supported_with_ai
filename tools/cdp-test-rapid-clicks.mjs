import WebSocket from "ws";

async function testRapidClicks() {
  const tabs = await fetch("http://127.0.0.1:9222/json").then((r) => r.json());
  const tab = tabs.find((t) => t.url.includes("localhost:3000"));
  if (!tab) return;

  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.id === msgId) {
          ws.off("message", handler);
          resolve(parsed.result);
        }
      };
      ws.on("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  ws.on("open", async () => {
    await send("Runtime.enable");
    await send("Page.enable");

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log(`[RAPID CONSOLE ${msg.params.type}]`, msg.params.args.map((a) => a.value || a.description).join(" "));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        console.log("[RAPID EXCEPTION]", msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
      }
    });

    await send("Page.navigate", { url: "http://localhost:3000/route" });
    await new Promise((r) => setTimeout(r, 3000));

    const res = await send("Runtime.evaluate", {
      expression: `
        (async () => {
          const log = [];
          for (let step = 0; step < 10; step++) {
            const cards = Array.from(document.querySelectorAll('div[class*="altCard"]'));
            const cardIdx = step % cards.length;
            if (cards[cardIdx]) {
              cards[cardIdx].click();
            }
            await new Promise(r => setTimeout(r, 200));

            const currentCards = Array.from(document.querySelectorAll('div[class*="altCard"]'));
            const selected = currentCards.find(c => c.className.includes('altCardSelected'));
            const selectedTitle = selected?.querySelector('span[class*="altBadge"]')?.textContent?.trim();
            const map = window.__DEBUG_MAP__;
            const renderedFeatures = map ? map.queryRenderedFeatures({ layers: ["route-core-layer"] }) : [];

            log.push({
              step,
              clickedIdx: cardIdx,
              totalCardsInDOM: currentCards.length,
              selectedTitle,
              renderedCount: renderedFeatures.length,
            });
          }
          return JSON.stringify(log);
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("RAPID CLICKS LOG:", res.result?.value);
    ws.close();
    process.exit(0);
  });
}

testRapidClicks().catch(console.error);
