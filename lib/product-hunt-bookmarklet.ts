type BookmarkletInput = {
  launchPackId: string;
  token: string;
  origin: string;
};

function cleanOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

export function buildProductHuntAutofillUrl(input: BookmarkletInput) {
  const params = new URLSearchParams({ token: input.token });

  return `${cleanOrigin(input.origin)}/api/launch-packs/${input.launchPackId}/product-hunt/bookmarklet?${params.toString()}`;
}

export function buildProductHuntBookmarklet(input: BookmarkletInput) {
  const autofillUrl = buildProductHuntAutofillUrl(input);
  const script = `
    (async () => {
      const neverSubmit = true;
      const response = await fetch(${JSON.stringify(autofillUrl)}, { credentials: "omit" });
      if (!response.ok) throw new Error("Unable to load ProofPitch Product Hunt fields.");
      const payload = await response.json();
      const fields = payload.productHunt || {};
      const setValue = (labels, value) => {
        if (!value) return;
        const selectors = [
          "input",
          "textarea",
          "[contenteditable=true]",
        ];
        const normalized = labels.map((label) => label.toLowerCase());
        for (const element of document.querySelectorAll(selectors.join(","))) {
          const name = [
            element.getAttribute("name"),
            element.getAttribute("aria-label"),
            element.getAttribute("placeholder"),
            element.id,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!normalized.some((label) => name.includes(label))) continue;
          if ("value" in element) element.value = value;
          else element.textContent = value;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
      };
      setValue(["name", "product"], fields.productName);
      setValue(["tagline"], fields.tagline);
      setValue(["website", "url", "link"], fields.interactiveDemoUrl);
      setValue(["description"], fields.description);
      setValue(["maker comment", "first comment", "comment"], fields.makerComment);
      setValue(["youtube", "video"], fields.youtubeUrl);
      window.alert("ProofPitch filled matching Product Hunt fields. Review every field before posting. Auto-submit is intentionally disabled.");
      return neverSubmit;
    })().catch((error) => window.alert(error.message));
  `.replace(/\s+/g, " ").trim();

  return `javascript:${script}`;
}
