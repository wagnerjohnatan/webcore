# WebCore 1.0 — GitHub + Vercel + Admin Google

Projeto preparado para:

- abrir diretamente no VS Code;
- versionar no GitHub;
- importar no Vercel;
- manter o site público;
- proteger o painel **Admin** com Google Sign-In;
- garantir a autorização no backend usando `ADMIN_GOOGLE_SUB`;
- manter a `GEMINI_API_KEY` fora do navegador e fora do GitHub;
- executar a manutenção do catálogo via Gemini somente para o administrador.

## Estrutura

```text
WebCore_Vercel/
├── index.html
├── package.json
├── vercel.json
├── .gitignore
├── .env.example
├── README.md
├── lib/
│   └── auth.js
└── api/
    ├── admin-auth.js
    ├── config.js
    ├── gemini-maintenance.js
    └── health.js
```

## Segurança adotada

O frontend **não contém**:

- senha de administrador;
- `ADMIN_GOOGLE_SUB`;
- `ADMIN_EMAIL`;
- `GEMINI_API_KEY`.

O navegador recebe apenas o `GOOGLE_CLIENT_ID`, que não é segredo.

Ao fazer login:

```text
Google Sign-In
      ↓
ID Token
      ↓
/api/admin-auth
      ↓
Google Auth Library valida o token
      ↓
backend compara SUB + e-mail
      ↓
autorizado ou 403
```

Mesmo que alguém altere o JavaScript pelo DevTools, as rotas protegidas continuam validando a identidade no servidor.

---

# 1. Abrir no VS Code

Extraia a pasta e abra:

```bash
code WebCore_Vercel
```

Se preferir pelo VS Code:

**File > Open Folder > WebCore_Vercel**

---

# 2. Criar o OAuth Client no Google

No Google Cloud:

1. Abra **Google Auth Platform > Clients**.
2. Crie um cliente.
3. Tipo: **Web application**.
4. Dê um nome, por exemplo `WebCore`.
5. Em **Authorized JavaScript origins**, adicione primeiro o endereço local se for testar:
   - `http://localhost:3000`
6. Depois do primeiro deploy no Vercel, adicione também:
   - `https://SEU-PROJETO.vercel.app`
7. Se usar domínio próprio, adicione também a origem do domínio.
8. Copie o Client ID terminado em `.apps.googleusercontent.com`.

Não é necessário colocar `GOOGLE_CLIENT_SECRET` neste projeto.

---

# 3. Subir no GitHub

Dentro da pasta:

```bash
git init
git add .
git commit -m "WebCore 1.0 - deploy Vercel"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

O arquivo `.gitignore` já impede o envio de `.env.local`.

---

# 4. Importar no Vercel

1. Entre no Vercel.
2. **Add New > Project**.
3. Importe o repositório do GitHub.
4. Framework Preset: pode permanecer como **Other**.
5. Não é necessário configurar Build Command.
6. Faça o primeiro deploy.

O Vercel publicará o `index.html` e transformará os arquivos em `/api` em Functions.

---

# 5. Configurar as Environment Variables

No Vercel:

**Project > Settings > Environment Variables**

Configure:

| Variável | Tipo recomendado | Valor |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Config | Client ID do Google |
| `ADMIN_EMAIL` | Secret | seu e-mail Google |
| `ADMIN_GOOGLE_SUB` | Secret | deixe vazio no primeiro deploy |
| `GEMINI_API_KEY` | Secret | chave do Gemini |
| `GEMINI_MODEL` | Config | `gemini-3.8-flash` |
| `GEMINI_USE_GOOGLE_SEARCH` | Config | `false` inicialmente |
| `DONATION_URL` | Config | opcional |

Após alterar variáveis, faça um **Redeploy**.

---

# 6. Descobrir seu ADMIN_GOOGLE_SUB de forma segura

No primeiro deploy:

1. Configure `GOOGLE_CLIENT_ID`.
2. Configure `ADMIN_EMAIL` com exatamente a conta Google que será administradora.
3. Deixe `ADMIN_GOOGLE_SUB` vazio.
4. Faça deploy.
5. Acesse o site.
6. Clique em **Admin**.
7. Faça login com sua conta Google.
8. Como o SUB ainda está vazio, o backend utilizará seu `ADMIN_EMAIL` apenas como etapa de configuração inicial.
9. O painel mostrará seu **Google SUB**.
10. Clique em **Copiar Google SUB**.
11. No Vercel, crie/preencha:

```text
ADMIN_GOOGLE_SUB=seu_sub_aqui
```

12. Faça novo deploy.

A partir desse momento o backend entra no modo estrito. Se `ADMIN_EMAIL` também estiver configurado, os dois valores precisam corresponder à conta autenticada.

---

# 7. Atualizar Authorized JavaScript origins

Depois de saber sua URL definitiva no Vercel, volte ao Google Cloud e confira se consta exatamente a origem:

```text
https://SEU-PROJETO.vercel.app
```

Exemplo:

```text
https://webcore.vercel.app
```

Não inclua barra final nem `/admin`.

Para Preview Deployments do Vercel, prefira testar o login no domínio de produção ou adicione explicitamente uma origem de preview estável que você controla.

---

# 8. Gemini

A chave Gemini fica somente na variável:

```text
GEMINI_API_KEY
```

O frontend nunca recebe essa chave.

Quando o administrador clica em:

**Verificar Atualizações do Catálogo Agora**

o fluxo é:

```text
Admin autenticado
      ↓
POST /api/gemini-maintenance
      ↓
validação do Google ID Token
      ↓
validação ADMIN_GOOGLE_SUB
      ↓
Gemini API
      ↓
Pesquisa Google (somente se ativada)
      ↓
relatório + fontes
```

A IA apenas recomenda alterações. O código do catálogo não é modificado automaticamente.

---

# 9. Teste rápido

Depois do deploy:

### Aplicação

Abra:

```text
https://SEU-PROJETO.vercel.app
```

### API de saúde

Abra:

```text
https://SEU-PROJETO.vercel.app/api/health
```

Resultado esperado:

```json
{
  "ok": true,
  "app": "WebCore 1.0"
}
```

### Admin

Clique em **Admin** e use sua conta Google.

Uma conta diferente deve receber:

```text
Conta Google não autorizada para administrar o WebCore.
```

---

# 10. Teste local opcional com Vercel CLI

Instale a CLI:

```bash
npm install -g vercel
```

Depois:

```bash
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Normalmente o endereço local será:

```text
http://localhost:3000
```

Adicione essa origem no Google Cloud para o login funcionar localmente.

---

# Observações importantes

## Não faça isto

Nunca coloque no `index.html`, GitHub ou `localStorage`:

```text
GEMINI_API_KEY
ADMIN_GOOGLE_SUB
senha administrativa
Google Client Secret
```

## Token do Google

O ID Token recebido durante o login é mantido apenas na memória da página. Ao atualizar a página, será necessário autenticar novamente. Isso foi feito intencionalmente para reduzir a persistência de credenciais no navegador.

## QR Code

A URL de doação é controlada pela variável `DONATION_URL` no Vercel. Não é armazenada no navegador.

## Catálogo

O catálogo original do WebCore foi preservado. A manutenção com Gemini envia uma representação do catálogo ao backend e devolve recomendações para revisão manual.


## Pesquisa Google e custos

O projeto vem com:

```text
GEMINI_USE_GOOGLE_SEARCH=false
```

Assim, o Gemini não executa pesquisa web automaticamente.

Se você quiser que a manutenção consulte informações atuais na Web, altere para:

```text
GEMINI_USE_GOOGLE_SEARCH=true
```

O Grounding com Pesquisa Google pode ter cobrança própria conforme o modelo e a conta. Ative somente depois de conferir a política de preços da sua chave/projeto Gemini.
