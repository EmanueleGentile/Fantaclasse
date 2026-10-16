/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// POCKETBASE SERVER-SIDE SECURITY HOOKS — FANTACLASSE
// 1. Validazione rigorosa e sanitizzazione anti-XSS / anti-link su Feedback
// 2. Endpoint atomico per upvote senza esporre permessi update pubblici
// =============================================================================

onRecordCreateRequest((e) => {
    const record = e.record;
    if (!record) {
        return e.next();
    }

    const forbiddenPattern = /(?:https?:\/\/|ftp:\/\/|www\.|<[^>]*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on(?:error|load|click|mouseover|focus)\s*=|\beval\s*\(|\balert\s*\()/i;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

    const nomeUtente = String(record.get("nome_utente") || "").replace(/[<>]/g, "").trim().slice(0, 40);
    const titolo = String(record.get("titolo") || "").replace(/[<>]/g, "").trim().slice(0, 80);
    const messaggio = String(record.get("messaggio_feedback") || "").replace(/[<>]/g, "").trim();
    const categoria = String(record.get("categoria") || "idea").trim();
    const voto = Number(record.get("voto") || 5);
    const anonimo = Boolean(record.get("anonimo"));

    const allowedCategories = ["idea", "like", "improve", "bug", "feature", "other"];

    if (messaggio.length < 5 || messaggio.length > 1000) {
        throw new BadRequestError("Il messaggio deve contenere tra 5 e 1000 caratteri.");
    }

    if (allowedCategories.indexOf(categoria) === -1) {
        throw new BadRequestError("Categoria non valida.");
    }

    if (isNaN(voto) || voto < 1 || voto > 5) {
        throw new BadRequestError("Il voto deve essere compreso tra 1 e 5.");
    }

    if (
        forbiddenPattern.test(nomeUtente) ||
        forbiddenPattern.test(titolo) ||
        forbiddenPattern.test(messaggio) ||
        emailPattern.test(nomeUtente) ||
        emailPattern.test(titolo) ||
        emailPattern.test(messaggio)
    ) {
        throw new BadRequestError("Contenuto bloccato: non sono ammessi link, script, tag HTML o indirizzi email.");
    }

    // Forza valori sicuri lato server (impedisce privilege escalation / spoofing)
    record.set("nome_utente", anonimo ? "" : nomeUtente);
    record.set("titolo", titolo);
    record.set("messaggio_feedback", messaggio);
    record.set("categoria", categoria);
    record.set("voto", Math.round(voto));
    record.set("anonimo", anonimo);
    record.set("upvotes", 0);
    record.set("stato", "in_valutazione");
    record.set("risposta_admin", "");

    return e.next();
}, "Feedback");

// Endpoint sicuro per incrementare solo il contatore upvotes (+1)
// senza concedere permessi di update (PATCH) pubblici sulla collezione Feedback
routerAdd("POST", "/api/feedback/{id}/upvote", (e) => {
    const id = e.request.pathValue("id");
    if (!id || !/^[a-zA-Z0-9_-]{1,30}$/.test(id)) {
        throw new BadRequestError("ID feedback non valido.");
    }

    const record = $app.findRecordById("Feedback", id);
    const currentUpvotes = Number(record.get("upvotes") || 0);
    const nextUpvotes = Math.min(Math.max(currentUpvotes, 0) + 1, 999999);

    record.set("upvotes", nextUpvotes);
    $app.save(record);

    return e.json(200, {
        id: record.id,
        upvotes: nextUpvotes
    });
});
