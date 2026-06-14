/**
 * routes/legal.js
 *
 * Serves a Privacy Policy page at /privacy. Meta requires a public privacy
 * policy URL to publish an app. Business name + contact come from env
 * (PRIVACY_ENTITY, PRIVACY_CONTACT) so they can be changed without code edits.
 *
 * NOTE: this is a reasonable template, NOT legal advice. Review/adapt it to your
 * actual data practices (LGPD) before publishing.
 */

import { Router } from 'express';
import { PRIVACY_ENTITY, PRIVACY_CONTACT } from '../config/index.js';

export const legalRoutes = Router();

legalRoutes.get('/privacy', (req, res) => {
  const entity = escapeHtml(PRIVACY_ENTITY);
  const contact = PRIVACY_CONTACT ? escapeHtml(PRIVACY_CONTACT) : null;
  res
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(renderPrivacy(entity, contact));
});

legalRoutes.get('/terms', (req, res) => {
  const entity = escapeHtml(PRIVACY_ENTITY);
  const contact = PRIVACY_CONTACT ? escapeHtml(PRIVACY_CONTACT) : null;
  res
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(renderTerms(entity, contact));
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function renderPrivacy(entity, contact) {
  const reach = contact
    ? `pelo e-mail <a href="mailto:${contact}">${contact}</a>`
    : `pelo canal de atendimento informado no nosso perfil do Instagram`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Política de Privacidade — ${entity}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65; color: #1a1a1a; background: #fff; max-width: 760px;
    margin: 0 auto; padding: 40px 22px 80px; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 32px; }
  .muted { color: #666; font-size: 14px; }
  a { color: #1a5fd0; }
  ul { padding-left: 22px; }
  footer { margin-top: 48px; color: #888; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px; }
</style>
</head>
<body>
  <h1>Política de Privacidade</h1>
  <p class="muted">${entity} · Vigência: junho de 2026</p>

  <p>Esta Política descreve como ${entity} ("nós") coleta, usa e protege as informações
  de usuários que interagem conosco por meio de mensagens diretas (Direct) do Instagram.</p>

  <h2>1. Informações que coletamos</h2>
  <p>Quando você nos envia uma mensagem pelo Instagram Direct, podemos coletar:</p>
  <ul>
    <li>O conteúdo das mensagens que você envia;</li>
    <li>O seu identificador de usuário do Instagram (ID);</li>
    <li>Quando disponível e autorizado, o seu nome de usuário e a foto de perfil públicos.</li>
  </ul>
  <p>Não coletamos senhas nem dados de pagamento por este canal.</p>

  <h2>2. Como usamos as informações</h2>
  <ul>
    <li>Responder às suas mensagens, de forma automática (assistente de inteligência artificial) e/ou por atendimento humano;</li>
    <li>Manter o contexto e o histórico da conversa para um atendimento contínuo;</li>
    <li>Melhorar a qualidade do atendimento.</li>
  </ul>

  <h2>3. Compartilhamento com terceiros</h2>
  <p>Para responder às suas mensagens, podemos compartilhar o conteúdo da conversa com:</p>
  <ul>
    <li><strong>Meta/Instagram</strong>, plataforma pela qual a comunicação ocorre, conforme as políticas da Meta;</li>
    <li><strong>Provedores de inteligência artificial</strong>, que processam o texto das mensagens para gerar as respostas.</li>
  </ul>
  <p>Não vendemos os seus dados a terceiros.</p>

  <h2>4. Armazenamento e retenção</h2>
  <p>O histórico das conversas é armazenado de forma segura em nossos servidores apenas
  pelo tempo necessário ao atendimento. Adotamos medidas técnicas razoáveis para proteger
  essas informações.</p>

  <h2>5. Os seus direitos (LGPD)</h2>
  <p>Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode acessar,
  corrigir e solicitar a exclusão dos seus dados. Para exercer esses direitos, entre em
  contato ${reach}.</p>

  <h2>6. Exclusão de dados</h2>
  <p>Você pode solicitar a exclusão dos seus dados a qualquer momento ${reach}. Também
  atendemos às solicitações de exclusão encaminhadas pela plataforma da Meta.</p>

  <h2>7. Alterações nesta Política</h2>
  <p>Podemos atualizar esta Política periodicamente. A versão vigente estará sempre
  disponível nesta página.</p>

  <h2>8. Contato</h2>
  <p>Em caso de dúvidas sobre esta Política, entre em contato ${reach}.</p>

  <footer>Esta página é a Política de Privacidade oficial de ${entity} para os fins de
  integração com a Plataforma do Instagram/Meta.</footer>
</body>
</html>`;
}

function renderTerms(entity, contact) {
  const reach = contact
    ? `pelo e-mail <a href="mailto:${contact}">${contact}</a>`
    : `pelo canal de atendimento informado no nosso perfil do Instagram`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Termos de Uso — ${entity}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65; color: #1a1a1a; background: #fff; max-width: 760px;
    margin: 0 auto; padding: 40px 22px 80px; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 32px; }
  .muted { color: #666; font-size: 14px; }
  a { color: #1a5fd0; }
  ul { padding-left: 22px; }
  footer { margin-top: 48px; color: #888; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px; }
</style>
</head>
<body>
  <h1>Termos de Uso</h1>
  <p class="muted">${entity} · Vigência: junho de 2026</p>

  <p>Ao interagir com ${entity} por meio de mensagens diretas (Direct) do Instagram,
  você concorda com estes Termos de Uso. Se não concordar, por favor não utilize este canal.</p>

  <h2>1. Descrição do serviço</h2>
  <p>${entity} oferece atendimento por mensagens no Instagram que pode ser respondido de
  forma automática (assistente de inteligência artificial) e/ou por atendimento humano.
  O assistente automático é ativado a pedido do próprio usuário.</p>

  <h2>2. Uso aceitável</h2>
  <p>Você concorda em não utilizar este canal para fins ilegais, ofensivos, fraudulentos
  ou que violem os termos da Meta/Instagram. Podemos limitar ou encerrar o atendimento
  em caso de uso abusivo.</p>

  <h2>3. Respostas automatizadas</h2>
  <p>As respostas podem ser geradas por inteligência artificial e têm caráter informativo.
  Elas podem conter imprecisões e não substituem orientação profissional (jurídica, médica,
  financeira, entre outras). Confirme informações importantes por um canal oficial antes
  de tomar decisões.</p>

  <h2>4. Disponibilidade</h2>
  <p>O serviço é fornecido "no estado em que se encontra", sem garantia de disponibilidade
  ininterrupta. Podemos suspender, alterar ou descontinuar o serviço a qualquer momento.</p>

  <h2>5. Limitação de responsabilidade</h2>
  <p>Na máxima extensão permitida pela lei aplicável, ${entity} não se responsabiliza por
  danos decorrentes do uso ou da impossibilidade de uso deste canal de atendimento,
  incluindo respostas automatizadas.</p>

  <h2>6. Privacidade</h2>
  <p>O tratamento dos seus dados é descrito na nossa
  <a href="/privacy">Política de Privacidade</a>.</p>

  <h2>7. Alterações</h2>
  <p>Podemos atualizar estes Termos periodicamente. A versão vigente estará sempre
  disponível nesta página.</p>

  <h2>8. Contato</h2>
  <p>Em caso de dúvidas sobre estes Termos, entre em contato ${reach}.</p>

  <footer>Esta página contém os Termos de Uso oficiais de ${entity} para os fins de
  integração com a Plataforma do Instagram/Meta.</footer>
</body>
</html>`;
}
