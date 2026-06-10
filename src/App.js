import { useState, useRef } from "react";

const SYSTEM_PROMPT = `You are an expert estimator for Owners Choice Construction LLC, a residential repair contractor in Greenville/Upstate SC. You create closing repair estimates from home inspection reports and repair addendums.

COMPANY INFO:
- Owners Choice Construction LLC
- Jason Evans
- (864) 252-4999
- jason@ownerschoiceconstruction.com
- 3122 Wade Hampton Blvd, Taylors, SC 29687

PRICING RULES (client-facing prices after markup):
- In-house labor: $89/hr billed (min 1 hr = $89, 1.5 hrs = $133.50, 2 hrs = $178)
- Subcontractor work: 45% markup over their cost
- Materials: ~65% markup over cost
- Simple fixes (secure, tighten, adjust): $133 to $222
- Seal/caulk/minor exterior: $178 to $290
- Electrical minor (outlets, screws, bulbs): $60 to $217
- Smoke/CO detectors (combo, multiple): $273 to $362
- GFCI outlet install (per area): $178 to $217
- Window glass single pane: around $368
- Window glass double pane: around $762
- Plumbing minor (drain, shower head, valve adjust): $133 to $357
- Expansion tank install: $571 to $645
- Plumbing subcontractor work (clogged drains, bathtub overflow): $178 to $429
- Crawlspace subcontractor inspection: $133 to $218
- Crawlspace insulation (sub): $1200 to $1740
- Foundation vent screen: $178 to $218
- Roofing evaluation plus selective repair (sub): $725 to $3300
- Vinyl siding repairs: $1200 to $2000 depending on extent
- Masonry/retaining wall (sub): $650 to $1500
- HVAC evaluation (sub): $285 to $357
- Garbage disposal replacement: $500 to $634
- Chimney cap measure/fab/install: around $1214 (2 trips, 2-week lead time)
- Exterior door jamb/rot repair: $500 to $750
- Downspout extension/repair: $178 to $260
- Attic pulldown stair adjustment: $133 to $178
- Dryer vent cap replacement: $218 to $260
- Loose countertop repair: $178 to $183
- Wood rot evaluation: $133 to $178
- Active leak evaluation: $133 to $178
- Panel screw replacement: $45 to $65
- Demo/haul away structures: varies widely $3000 to $8000+
- Fireblocking install: $350 to $450
- Gas bonding: around $652
- Water heater relocation (sub): $3500 to $5300
- Subfloor evaluation: $133 to $178

SCOPE RULES:
1. Only include items in a general contractor scope (handyman, plumbing subs, electrical subs, HVAC subs, roofing subs, crawlspace subs, masonry subs).
2. Do NOT include: septic/sewer scope, termite/pest inspections, cosmetic items like carpet stains or paint, items clearly outside contractor scope.
3. Group related items when it makes sense (e.g. two shower heads in different bathrooms = one line item).
4. Use inspection report section numbers as the line item title prefix (e.g. "3.3.1 - Roof Evaluation...").
5. When multiple inspection numbers apply to one line item, list them all (e.g. "11.5.1, 12.5.1 - Shower Head Repairs").
6. Write scope descriptions using bullet points starting with a dash for multi-step scopes.
7. Add NOTE: callouts where there are important caveats, unknowns, or additional cost risks.

DISCLAIMER TEXT (always the first line item at $0.00):
This estimate has been prepared based on information provided in the inspection report and limited available details. Actual costs may vary depending on site conditions, accessibility, extent of damage, and any additional work required that was not visible or documented in the report. Any necessary adjustments to scope or pricing will be communicated and approved prior to proceeding with the work.

OUTPUT FORMAT: Respond with ONLY a valid JSON object. No markdown fences, no explanation, just raw JSON.
{
  "property_address": "full address from documents",
  "client_name": "name from documents",
  "client_phone": "phone if found else empty string",
  "client_email": "email if found else empty string",
  "line_items": [
    {
      "title": "Disclaimer",
      "description": "This estimate has been prepared based on information provided in the inspection report and limited available details. Actual costs may vary depending on site conditions, accessibility, extent of damage, and any additional work required that was not visible or documented in the report. Any necessary adjustments to scope or pricing will be communicated and approved prior to proceeding with the work.",
      "price": 0,
      "notes": null
    },
    {
      "title": "X.X.X - Line Item Title Here",
      "description": "- Scope bullet one\n- Scope bullet two",
      "price": 285.61,
      "notes": "NOTE: caveat here, or null if none"
    }
  ],
  "total": 0000.00,
  "skipped_items": ["item description - reason it was excluded"]
}`;

function fmt(price) {
  if (price === 0) return "$0.00";
  return "$" + Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildPrintHTML(estimate, resolved) {
  const today = new Date();
  const fmtDate = (d) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const issueDate = fmtDate(today);
  const expireDate = fmtDate(new Date(today.getTime() + 14 * 86400000));

  const itemsHTML = estimate.line_items
    .map((item) => {
      const bullets = (item.description || "")
        .split("\n")
        .map((line) => {
          if (line.startsWith("-")) {
            return "<li style='margin:2px 0'>" + line.slice(1).trim() + "</li>";
          }
          return "<span>" + line + "</span>";
        })
        .join("");

      const descHTML =
        item.title === "Disclaimer"
          ? "<p style='margin:4px 0 0;color:#555;font-size:12px'>" + item.description + "</p>"
          : "<ul style='margin:4px 0 0 16px;padding:0;color:#555;font-size:12px'>" + bullets + "</ul>";

      const noteHTML = item.notes
        ? "<p style='margin:5px 0 0;font-size:11.5px;color:#666;font-style:italic'>" + item.notes + "</p>"
        : "";

      return (
        "<tr>" +
        "<td style='padding:10px 0;border-bottom:0.5px solid #ddd;vertical-align:top'>" +
        "<strong style='font-size:13px'>" + item.title + "</strong>" +
        descHTML +
        noteHTML +
        "</td>" +
        "<td style='padding:10px 0 10px 16px;border-bottom:0.5px solid #ddd;vertical-align:top;text-align:right;white-space:nowrap;font-weight:600;font-size:13px'>" +
        fmt(item.price) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
    "<title>Closing Repairs Estimate - " + estimate.property_address + "</title>" +
    "<style>" +
    "*{box-sizing:border-box;margin:0;padding:0}" +
    "body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.5;padding:40px;max-width:820px;margin:0 auto}" +
    ".hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:1px solid #bbb;margin-bottom:14px}" +
    ".hdr-title{font-size:20px;font-weight:700}" +
    ".parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding-bottom:14px;border-bottom:1px solid #bbb;margin-bottom:14px}" +
    ".lbl{font-size:10px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}" +
    "table{width:100%;border-collapse:collapse}" +
    "th{font-size:10px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:5px 0;border-bottom:1.5px solid #999;text-align:left}" +
    "th:last-child{text-align:right}" +
    ".total td{padding:12px 0;border-top:1.5px solid #999;font-weight:700;font-size:14px}" +
    ".total td:last-child{text-align:right}" +
    "@media print{body{padding:20px}@page{margin:.5in}}" +
    "</style></head><body>" +
    "<div class='hdr'>" +
    "<div><div class='hdr-title'>Closing Repairs Estimate</div></div>" +
    "<div style='text-align:right;font-size:12px;color:#555'><div>Issue Date " + issueDate + "</div><div>Expires " + expireDate + "</div></div>" +
    "</div>" +
    "<div class='parties'>" +
    "<div><div class='lbl'>Prepared By</div><strong>Jason Evans</strong><div>Owners Choice Construction</div><div>(864) 252-4999</div><div>jason@ownerschoiceconstruction.com</div><div>3122 Wade Hampton Blvd, Taylors, SC 29687</div></div>" +
    "<div><div class='lbl'>Prepared For</div>" +
    (resolved.name ? "<strong>" + resolved.name + "</strong>" : "") +
    "<div>" + estimate.property_address + "</div>" +
    (resolved.phone ? "<div>" + resolved.phone + "</div>" : "") +
    (resolved.email ? "<div>" + resolved.email + "</div>" : "") +
    "</div></div>" +
    "<div class='lbl'>Closing Repairs Estimate Details</div>" +
    "<div style='font-size:15px;font-weight:700;margin:2px 0 14px'>" + estimate.property_address + "</div>" +
    "<table><thead><tr><th>Description</th><th>Total</th></tr></thead>" +
    "<tbody>" + itemsHTML + "</tbody>" +
    "<tfoot><tr class='total'><td>TOTAL</td><td>" + fmt(estimate.total) + "</td></tr></tfoot>" +
    "</table></body></html>"
  );
}

function UploadBox({ label, file, onFile }) {
  const ref = useRef();
  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  };
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current.click()}
      style={{
        border: "1.5px dashed var(--color-border-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1.25rem",
        cursor: "pointer",
        background: file
          ? "var(--color-background-success)"
          : "var(--color-background-secondary)",
        minHeight: 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textAlign: "center",
        transition: "background 0.2s",
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <>
          <i className="ti ti-check" style={{ fontSize: 22, color: "var(--color-text-success)" }} />
          <span style={{ fontSize: 13, color: "var(--color-text-success)", fontWeight: 500 }}>
            {file.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-success)" }}>Click to replace</span>
        </>
      ) : (
        <>
          <i className="ti ti-upload" style={{ fontSize: 22, color: "var(--color-text-secondary)" }} />
          <span style={{ fontSize: 14, color: "var(--color-text-primary)", fontWeight: 500 }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Click or drag and drop PDF
          </span>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [inspFile, setInspFile] = useState(null);
  const [addFile, setAddFile] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [wufoo, setWufoo] = useState("");
  const [showWufoo, setShowWufoo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("upload");

  const toBase64 = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = () => rej(new Error("File read failed"));
      r.readAsDataURL(file);
    });

  const LOAD_MSGS = [
    "Reading inspection report...",
    "Analyzing repair addendum...",
    "Matching items to your pricing...",
    "Writing scope descriptions...",
    "Building your estimate...",
  ];

  const generate = async () => {
    if (!inspFile || !addFile) return;
    setLoading(true);
    setError(null);
    setEstimate(null);
    let mi = 0;
    setLoadMsg(LOAD_MSGS[0]);
    const iv = setInterval(() => {
      mi = Math.min(mi + 1, LOAD_MSGS.length - 1);
      setLoadMsg(LOAD_MSGS[mi]);
    }, 2800);

    try {
      const [inspB64, addB64] = await Promise.all([
        toBase64(inspFile),
        toBase64(addFile),
      ]);

      

      const extra = wufoo.trim()
        ? "\n\nAdditional context from Wufoo inquiry email:\n" + wufoo.trim()
        : "";

      const userText =
        "Using the attached home inspection report and repair addendum, generate a closing repairs estimate for Owners Choice Construction.\n\n" +
        "Only include items within a general contractor scope. Cross-reference the addendum with the inspection report to write accurate scope descriptions.\n\n" +
        (clientName ? "Client name: " + clientName + "\n" : "Extract client name from the documents.\n") +
        (clientPhone ? "Client phone: " + clientPhone + "\n" : "") +
        (clientEmail ? "Client email: " + clientEmail + "\n" : "") +
        extra +
        "\n\nRespond with ONLY the raw JSON object. No markdown, no explanation.";

      const res = await fetch("https://occ-estimator-proxy.jason-ca3.workers.dev/", {
        method: "POST",
       headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: inspB64 },
                },
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: addB64 },
                },
                { type: "text", text: userText },
              ],
            },
          ],
        }),
      });

      clearInterval(iv);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.content.map((b) => b.text || "").join("");
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found in response.");
      const parsed = JSON.parse(match[0]);
      setEstimate(parsed);
      setStep("preview");
    } catch (err) {
      clearInterval(iv);
      setError("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const printEstimate = () => {
    if (!estimate) return;
    const resolved = {
      name: clientName || estimate.client_name || "",
      phone: clientPhone || estimate.client_phone || "",
      email: clientEmail || estimate.client_email || "",
    };
    const html = buildPrintHTML(estimate, resolved);
    const win = window.open("", "_blank");
    if (!win) {
      alert("Pop-up was blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 700);
  };

  const reset = () => {
    setInspFile(null);
    setAddFile(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setWufoo("");
    setShowWufoo(false);
    setEstimate(null);
    setError(null);
    setStep("upload");
  };

  const resolved = {
    name: clientName || (estimate && estimate.client_name) || "",
    phone: clientPhone || (estimate && estimate.client_phone) || "",
    email: clientEmail || (estimate && estimate.client_email) || "",
  };

  const today = new Date();
  const fmtDate = (d) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ padding: "1.5rem 0", maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>
          <i className="ti ti-file-dollar" style={{ marginRight: 8 }} />
          Closing Repairs Estimate Generator
        </div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          Upload an inspection report and repair addendum to generate a formatted estimate.
        </div>
      </div>

      {step === "upload" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Home Inspection Report
              </div>
              <UploadBox label="Upload Inspection Report" file={inspFile} onFile={setInspFile} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Repair Addendum</div>
              <UploadBox label="Upload Repair Addendum" file={addFile} onFile={setAddFile} />
            </div>
          </div>

          <div
            style={{
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-lg)",
              padding: "14px 16px",
              marginBottom: 12,
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
              <i className="ti ti-user" style={{ marginRight: 6 }} />
              Client Info
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  fontWeight: 400,
                  marginLeft: 8,
                }}
              >
                optional — auto-detected from documents
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                ["Name", clientName, setClientName],
                ["Phone", clientPhone, setClientPhone],
                ["Email", clientEmail, setClientEmail],
              ].map(([label, val, setter]) => (
                <div key={label}>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {label}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={label}
                    style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setShowWufoo(!showWufoo)}
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              <i className="ti ti-mail" style={{ marginRight: 6 }} />
              {showWufoo ? "Hide" : "Paste Wufoo email"} (optional)
              <i
                className={"ti ti-chevron-" + (showWufoo ? "up" : "down")}
                style={{ marginLeft: 6 }}
              />
            </button>
            {showWufoo && (
              <div style={{ marginTop: 10 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Paste the Wufoo inquiry email body here. Client info and property address will be
                  extracted automatically.
                </label>
                <textarea
                  value={wufoo}
                  onChange={(e) => setWufoo(e.target.value)}
                  placeholder="Paste Wufoo email content here..."
                  rows={6}
                  style={{
                    width: "100%",
                    fontSize: 13,
                    fontFamily: "var(--font-sans)",
                    boxSizing: "border-box",
                    resize: "vertical",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-border-secondary)",
                    padding: "8px 10px",
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--color-background-danger)",
                borderRadius: "var(--border-radius-md)",
                fontSize: 13,
                color: "var(--color-text-danger)",
                marginBottom: 12,
              }}
            >
              <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={!inspFile || !addFile || loading}
            style={{
              width: "100%",
              padding: "11px 0",
              fontSize: 14,
              fontWeight: 500,
              cursor: inspFile && addFile && !loading ? "pointer" : "not-allowed",
              opacity: inspFile && addFile && !loading ? 1 : 0.5,
            }}
          >
            {loading ? (
              <span>
                <i
                  className="ti ti-loader-2"
                  style={{
                    marginRight: 6,
                    display: "inline-block",
                    animation: "spin 1s linear infinite",
                  }}
                />
                {loadMsg}
              </span>
            ) : (
              <span>
                <i className="ti ti-sparkles" style={{ marginRight: 6 }} />
                Generate Estimate
              </span>
            )}
          </button>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {step === "preview" && estimate && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <button onClick={reset} style={{ fontSize: 13, padding: "7px 14px" }}>
              <i className="ti ti-arrow-left" style={{ marginRight: 4 }} />
              New Estimate
            </button>
            <button
              onClick={printEstimate}
              style={{ fontSize: 13, padding: "7px 18px", fontWeight: 500 }}
            >
              <i className="ti ti-printer" style={{ marginRight: 6 }} />
              Print / Save as PDF
            </button>
          </div>

          <div
            style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px 24px",
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingBottom: 14,
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 500 }}>Closing Repairs Estimate</div>
              <div
                style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}
              >
                <div>Issue Date {fmtDate(today)}</div>
                <div>Expires {fmtDate(new Date(today.getTime() + 14 * 86400000))}</div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                paddingBottom: 14,
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 3,
                  }}
                >
                  Prepared By
                </div>
                <div style={{ fontWeight: 500 }}>Jason Evans</div>
                <div>Owners Choice Construction</div>
                <div>(864) 252-4999</div>
                <div style={{ color: "var(--color-text-info)" }}>
                  jason@ownerschoiceconstruction.com
                </div>
                <div>3122 Wade Hampton Blvd, Taylors, SC 29687</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 3,
                  }}
                >
                  Prepared For
                </div>
                {resolved.name && <div style={{ fontWeight: 500 }}>{resolved.name}</div>}
                <div>{estimate.property_address}</div>
                {resolved.phone && <div>{resolved.phone}</div>}
                {resolved.email && (
                  <div style={{ color: "var(--color-text-info)" }}>{resolved.email}</div>
                )}
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 2,
              }}
            >
              Closing Repairs Estimate Details
            </div>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 14 }}>
              {estimate.property_address}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom: "1px solid var(--color-border-primary)",
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Description
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Total
              </span>
            </div>

            {estimate.line_items.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{item.title}</span>
                  <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fmt(item.price)}</span>
                </div>
                {item.description && (
                  <div
                    style={{ marginTop: 3, color: "var(--color-text-secondary)", fontSize: 12 }}
                  >
                    {item.description.split("\n").map((line, j) =>
                      line.startsWith("-") ? (
                        <div key={j} style={{ display: "flex", gap: 6, marginTop: 2 }}>
                          <span style={{ color: "var(--color-text-tertiary)" }}>•</span>
                          <span>{line.slice(1).trim()}</span>
                        </div>
                      ) : (
                        <span key={j}>{line}</span>
                      )
                    )}
                  </div>
                )}
                {item.notes && (
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      fontStyle: "italic",
                    }}
                  >
                    {item.notes}
                  </div>
                )}
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderTop: "1px solid var(--color-border-primary)",
                fontWeight: 500,
                fontSize: 14,
                marginTop: 2,
              }}
            >
              <span>TOTAL</span>
              <span>{fmt(estimate.total)}</span>
            </div>
          </div>

          {estimate.skipped_items && estimate.skipped_items.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                background: "var(--color-background-warning)",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-warning)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-warning)",
                  marginBottom: 6,
                }}
              >
                <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
                Items excluded from estimate (outside scope or not applicable):
              </div>
              {estimate.skipped_items.map((s, i) => (
                <div
                  key={i}
                  style={{ fontSize: 12, color: "var(--color-text-warning)", marginTop: 2 }}
                >
                  • {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
