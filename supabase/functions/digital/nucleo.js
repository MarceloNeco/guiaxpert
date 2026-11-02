// SolverONE — núcleo da "digital conferida no servidor" (WebAuthn / passkey).
// JavaScript puro, sem nada do Deno: a função (index.ts) e o teste local (Node) usam o MESMO código.
// A biblioteca (@simplewebauthn/server) entra por parâmetro.

export const RP_NOME = "SolverONE";

export function criarNucleo(lib, cfg) {
  const rpID = cfg.rpID, origens = cfg.origens;
  const b64u = (bytes) => {
    let s = ""; const b = new Uint8Array(bytes);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const deB64u = (t) => {
    const s = atob(String(t).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(t).length + 3) % 4));
    const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b;
  };
  return {
    // cadastro: o celular cria uma chave de acesso presa a este site; o servidor guarda só a parte pública
    async opcoesCadastro(usuario, existentes) {
      return await lib.generateRegistrationOptions({
        rpName: RP_NOME, rpID,
        userName: usuario.email || usuario.id,
        userDisplayName: (usuario.email || "SolverONE") + " · chaves",
        userID: new TextEncoder().encode(usuario.id),
        attestationType: "none",
        excludeCredentials: (existentes || []).map((c) => ({ id: c.id, transports: c.transportes || undefined })),
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
        timeout: 60000,
      });
    },
    async conferirCadastro(resposta, desafio) {
      const v = await lib.verifyRegistrationResponse({
        response: resposta, expectedChallenge: desafio, expectedOrigin: origens, expectedRPID: rpID, requireUserVerification: true,
      });
      if (!v.verified || !v.registrationInfo) throw new Error("cadastro-recusado");
      const c = v.registrationInfo.credential;
      return { id: c.id, chave_publica: b64u(c.publicKey), contador: c.counter || 0, transportes: c.transports || null };
    },
    // confirmar: só aceita as chaves de acesso que esta conta cadastrou, com digital/rosto de verdade (UV)
    async opcoesEntrar(credenciais) {
      return await lib.generateAuthenticationOptions({
        rpID, userVerification: "required", timeout: 60000,
        allowCredentials: credenciais.map((c) => ({ id: c.id, transports: c.transportes || undefined })),
      });
    },
    async conferirEntrar(resposta, desafio, cred) {
      const v = await lib.verifyAuthenticationResponse({
        response: resposta, expectedChallenge: desafio, expectedOrigin: origens, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: cred.id, publicKey: deB64u(cred.chave_publica), counter: Number(cred.contador) || 0, transports: cred.transportes || undefined },
      });
      if (!v.verified) throw new Error("digital-recusada");
      return { contador: v.authenticationInfo.newCounter };
    },
  };
}
