# RaidManager
## Sistema de Gestão e Planeamento de Raids para Moto Clubes

---

| Campo | Valor |
|---|---|
| Documento | PRD-RAIDMANAGER-001 |
| Produto | RaidManager — Web App |
| Âmbito | Qualquer Moto Clube (multi-clube, personalizável) |
| Autor | [Nome do Product Owner] |
| Data | Maio 2025 |
| Versão | 1.0 — Draft |

---

## Índice

1. [Sumário Executivo](#1-sumário-executivo)
2. [Visão, Objectivos e Princípios](#2-visão-objectivos-e-princípios)
3. [Utilizadores e Perfis de Acesso](#3-utilizadores-e-perfis-de-acesso)
4. [Módulo 1 — Configuração e Personalização do Clube](#4-módulo-1--configuração-e-personalização-do-clube)
5. [Módulo 2 — Gestão de Membros](#5-módulo-2--gestão-de-membros)
6. [Módulo 3 — Gestão de Raids (Core)](#6-módulo-3--gestão-de-raids-core)
7. [Módulo 4 — Detalhe do Raid e Exportação PDF](#7-módulo-4--detalhe-do-raid-e-exportação-pdf)
8. [Módulo 5 — Checklists Digitais](#8-módulo-5--checklists-digitais)
9. [Módulo 6 — Histórico e Estatísticas](#9-módulo-6--histórico-e-estatísticas)
10. [Arquitectura Multi-Clube e Personalização](#10-arquitectura-multi-clube-e-personalização)
11. [Stack Tecnológico](#11-stack-tecnológico)
12. [Modelo de Dados](#12-modelo-de-dados)
13. [Requisitos Não Funcionais](#13-requisitos-não-funcionais)
14. [Fluxos Principais de UX](#14-fluxos-principais-de-ux)
15. [Roadmap de Desenvolvimento](#15-roadmap-de-desenvolvimento)
16. [Riscos e Mitigações](#16-riscos-e-mitigações)
17. [Glossário](#17-glossário)

---

## 1. Sumário Executivo

O **RaidManager** é uma aplicação web responsiva, multi-clube e totalmente personalizável, criada para digitalizar e profissionalizar a gestão de raids de qualquer moto clube. Qualquer clube pode criar a sua instância, configurar a identidade visual (logo, cores, estatuto) e começar a planear raids em minutos.

O sistema substitui documentos Word feitos manualmente, comunicação por WhatsApp e checklists em papel por uma plataforma centralizada com interface interactiva — botões, formulários assistidos por passos, exportação de PDF automática e notificações para os membros.

### 1.1 Problema Actual

| Sem RaidManager | Com RaidManager |
|---|---|
| Planos de raid criados manualmente em Word/PDF | Formulário guiado — raid criado em < 15 min |
| Cada clube usa o seu próprio template, sem padrão | Template universal, configurável por clube |
| Logo, cores e estatuto inexistentes no documento | Identidade do clube incorporada automaticamente em todos os documentos |
| Checklists em papel, perdidas ou ignoradas | Checklists digitais confirmadas individualmente por cada piloto |
| Plano de contingência verbal ou esquecido | Gerado automaticamente com base na rota e na equipa |
| Sem histórico — raids passados perdem-se | Arquivo permanente com estatísticas do clube e individuais |

---

## 2. Visão, Objectivos e Princípios

### 2.1 Visão do Produto

> *"Qualquer moto clube, em qualquer país, deve conseguir organizar um raid profissional e seguro em menos de 15 minutos — com a sua identidade, as suas regras e os seus membros."*

### 2.2 Objectivos de Negócio

- Ser utilizável por qualquer moto clube, independentemente de país, dimensão ou tipo de moto
- Permitir personalização total da identidade do clube (logo, cor de destaque, nome, estatuto, regras internas)
- Reduzir o tempo de preparação de um raid de horas para minutos
- Garantir que o PDF gerado automaticamente é indistinguível de um documento criado manualmente por um designer
- Suportar múltiplos clubes na mesma plataforma (multi-tenant)

### 2.3 Princípios de Design

| Princípio | O que significa na prática |
|---|---|
| Interactividade primeiro | Tudo acontece com botões e formulários. Nenhuma acção exige editar um ficheiro. |
| Personalizável por clube | Logo, cor, nome, estatuto e regras são configurados por cada clube e aparecem em todos os documentos gerados. |
| Zero fricção mobile | 100% funcional no telemóvel — confirmação de presença e checklist feitas do telefone, no estacionamento, antes de sair. |
| PDF automático de qualidade | O botão Exportar PDF gera imediatamente um documento completo, pronto a imprimir ou partilhar, sem edição manual. |
| Multi-clube | Cada clube tem a sua área isolada. Dados, membros e raids de um clube nunca são visíveis noutro. |

---

## 3. Utilizadores e Perfis de Acesso

O sistema tem 4 perfis. O acesso é gerido por cada clube — o Administrador cria as contas e atribui funções.

| Perfil | Quem é | O que pode fazer | Restrições |
|---|---|---|---|
| Administrador do Clube | Presidente ou secretário | Tudo: configurar clube, gerir membros, criar e editar raids, exportar, ver histórico | Apenas do seu clube |
| Capitão de Estrada | Organizador designado | Criar e editar raids, gerar PDF, gerir roteiros, ver membros | Não configura o clube |
| Membro Activo | Piloto participante | Ver raids, confirmar presença, preencher checklist, ver documentos do raid | Não cria raids |
| Apoio / Convidado | Veículo apoio, familiar | Ver rota e contactos de emergência do raid em que está incluído | Acesso só-leitura, por link |

---

## 4. Módulo 1 — Configuração e Personalização do Clube

Este é o ponto de partida de qualquer clube. Antes de criar membros ou raids, o Administrador configura a identidade e as regras do clube. Todos os documentos gerados (PDF de raid, fichas de membro, briefings) incorporam automaticamente estas definições.

### 4.1 Dados Gerais do Clube

- Nome oficial do clube
- Sigla / Acrónimo (ex: PDT, HMCC)
- Localidade / País base
- Data de fundação
- Lema / Motto
- Website e redes sociais (opcional)

### 4.2 Identidade Visual

- **Logo do clube** — upload de imagem (PNG/SVG, fundo transparente recomendado); aparece no cabeçalho de todos os PDFs e no painel do clube
- **Cor de destaque** — picker de cor hex; aplicada a cabeçalhos, botões, bordas e badges em todos os documentos gerados
- **Segundo logo / Patch traseiro** (opcional) — aparece no rodapé dos documentos

### 4.3 Estatuto e Regulamento Interno

O clube pode inserir o texto do seu estatuto e regulamento interno. Este conteúdo aparece como anexo nos PDFs de raid (secção opcional activada por toggle), permitindo que novos membros ou convidados tenham sempre acesso às regras do clube no documento do raid.

- Campo de texto rico (títulos, listas, parágrafos)
- Toggle por raid: incluir / não incluir estatuto no PDF
- Versão e data do estatuto registada no sistema

### 4.4 Configurações Padrão de Raid

Valores pré-definidos que servem de ponto de partida para todos os novos raids (o Capitão pode alterar em cada raid):

- Velocidade máxima padrão em comboio
- Distância mínima entre motos na formação
- Canal de rádio padrão (ex: PMR446 Canal 6)
- Cenários de contingência padrão — texto editável por cenário (acidente, avaria, separação, mau tempo), pré-preenchidos em cada novo raid
- Sinais de mão do clube — lista personalizável com descrição e imagem opcional

### 4.5 Contactos de Emergência por Região

Biblioteca de contactos de emergência. O clube insere hospitais, bombeiros e polícia nas regiões onde habitualmente faz raids. Quando um raid é criado com origem/destino nessas regiões, os contactos são sugeridos automaticamente no plano de contingência.

---

## 5. Módulo 2 — Gestão de Membros

Directório central de todos os membros do clube. Cada membro tem um perfil completo que é referenciado na criação de raids, na geração de PDFs e nas checklists.

### 5.1 Ficha de Membro

- Foto de perfil (upload)
- Nome completo e alcunha / nome de estrada
- Número de membro no clube
- Data de adesão
- Contacto telefónico
- Contacto de emergência (nome + telefone)
- Estatuto: Activo / Inactivo / Suspenso / Convidado
- Notas internas (visíveis só ao Administrador)

### 5.2 Veículos do Membro

Cada membro pode ter um ou mais veículos registados. No momento de confirmar presença num raid, o membro selecciona qual o veículo que vai usar.

- Marca, modelo, ano
- Matrícula
- Cilindrada e tipo (trail, estradeira, custom, scooter, apoio)
- Foto do veículo
- Notas técnicas (ex: "pneus novos", "corrente a substituir")

### 5.3 Acções na Lista de Membros

- **Botão Adicionar Membro** — abre formulário em painel lateral deslizante
- **Botão Editar** (por linha) — abre o mesmo formulário pré-preenchido
- **Botão Desactivar / Suspender** — não apaga, muda o estatuto
- **Botão Exportar Lista** — gera PDF com a lista do clube ou ficheiro CSV
- Pesquisa e filtros por nome, alcunha, estatuto, veículo

---

## 6. Módulo 3 — Gestão de Raids (Core)

O módulo central do sistema. A lista de raids mostra todos os raids do clube com o seu estado. A criação de um novo raid é feita por um assistente em 4 passos.

### 6.1 Lista de Raids

Vista principal do módulo. Mostra cards para cada raid com:

- Nome do raid
- Data e rota (origem → destino)
- Estado (badge colorido): `Rascunho` · `Confirmado` · `Em Curso` · `Concluído` · `Cancelado`
- Número de participantes confirmados vs. total convidados
- Acções rápidas por card: Ver Detalhes · Editar · Duplicar · Cancelar

> **Botão de destaque no topo da página: `Novo Raid →`**

### 6.2 Criação de Raid — Assistente em 4 Passos

Ao clicar em **Novo Raid**, abre-se um assistente passo a passo com barra de progresso. O utilizador só avança quando os campos obrigatórios do passo actual estão preenchidos.

---

#### Passo 1 de 4 — Dados Básicos

- Nome do raid (obrigatório)
- Data de saída (date picker)
- Ponto de partida — campo de texto livre
- Destino — campo de texto livre
- Dificuldade — selector: `Fácil` · `Médio` · `Difícil`
- Distância estimada (km) — campo numérico
- Duração estimada — calculada automaticamente ou inserida manualmente
- Tipo de estrada — checkboxes múltiplos: `Asfalto` · `Terra` · `Misto` · `Off-road`
- Descrição / notas gerais — campo de texto
- Velocidade máxima em comboio — pré-preenchida com o valor padrão do clube
- Canal de comunicação — pré-preenchido com o valor padrão do clube
- Alojamento (se aplicável) — nome e contacto

---

#### Passo 2 de 4 — Pontos de Rota

Lista dinâmica de pontos de paragem ao longo do raid. O primeiro ponto (Saída) e o último (Chegada) são criados automaticamente com o ponto de partida e destino do Passo 1.

- **Botão `+ Adicionar Ponto`** — insere uma nova linha na lista
- Por cada ponto: Nome do local · Tipo (`Saída` / `Pausa Técnica` / `Almoço` / `Pernoita` / `Chegada`) · Hora prevista · KM acumulados · Duração da paragem · Notas
- Botão de reordenação (arrastar e largar) — permite reordenar os pontos
- Botão Remover — elimina um ponto intermédio
- Cálculo automático de KM entre pontos quando inserida a distância total

---

#### Passo 3 de 4 — Equipa

Selecção dos participantes a partir da lista de membros activos do clube.

- Lista de todos os membros activos com checkbox de selecção
- Após seleccionar um membro: dropdown de função — `Líder` · `Cauda` · `Membro` · `Mecânico` · `Apoio (veículo)`
- Um membro com a função **Líder** é obrigatório para publicar o raid
- Campo para convidados externos (nome + função + contacto) — para membros de outros clubes ou familiares
- Visualização da formação em comboio gerada automaticamente com base nas funções atribuídas

---

#### Passo 4 de 4 — Contingência e Revisão

- 4 cenários pré-preenchidos com o texto padrão do clube (editável por raid):
  - Acidente / Queda
  - Avaria de Moto
  - Separação de Piloto
  - Condições Meteorológicas Adversas
- Contactos de emergência sugeridos automaticamente com base na rota (se configurados pelo clube)
- Ponto de reagrupamento de emergência — pré-preenchido com o 1.º ponto de rota, editável
- Resumo completo do raid para revisão antes de guardar
- Botões finais: **`Guardar como Rascunho`** · **`Publicar e Notificar Membros`**

---

### 6.3 Estados do Raid e Transições

| Estado | Descrição | Transição possível |
|---|---|---|
| Rascunho | Raid em criação, não visível para membros | → Confirmado |
| Confirmado | Visível para membros; confirmações abertas | → Em Curso · Cancelado |
| Em Curso | Data de hoje; raid a decorrer | → Concluído |
| Concluído | Raid terminado; entra no arquivo | — |
| Cancelado | Raid cancelado; motivo registado | — |

---

## 7. Módulo 4 — Detalhe do Raid e Exportação PDF

Após criar ou abrir um raid existente, a página de detalhe mostra todas as informações em secções, com uma barra de acções no topo.

### 7.1 Barra de Acções (topo da página)

| Botão | Acção | Disponível quando |
|---|---|---|
| **Exportar PDF** | Gera e faz download do PDF completo do raid | Qualquer estado |
| Partilhar Link | Copia link público (sem login) para partilhar no WhatsApp | Confirmado ou superior |
| Editar Raid | Abre o assistente de 4 passos pré-preenchido | Rascunho ou Confirmado |
| Duplicar Raid | Cria cópia com nova data, mantendo rota e equipa | Qualquer estado |
| Publicar | Muda estado para Confirmado e notifica membros | Rascunho |
| Cancelar Raid | Pede confirmação + motivo; muda estado | Confirmado |

### 7.2 Secções da Página de Detalhe

- **Cabeçalho** — nome do raid, rota (origem → destino), data, dificuldade, estado
- **Cards de métricas** — distância total, duração estimada, nº de participantes, tipo de estrada
- **Roteiro** — tabela com todos os pontos de rota (hora, km, tipo, notas)
- **Equipa** — lista de participantes com função, moto e estado da checklist
- **Formação em comboio** — representação visual da disposição das motos
- **Plano de contingência** — 4 cenários expandíveis com as acções a tomar
- **Contactos de emergência** — tabela com nome, função e telefone
- **Briefing** — guião formatado para leitura em voz alta antes da saída

### 7.3 Exportação PDF — Comportamento Detalhado

O botão **Exportar PDF** é o ponto de saída principal do sistema. O PDF gerado incorpora a identidade visual do clube e não é um simples print do ecrã.

**Antes de exportar**, o utilizador vê um painel de toggles com as secções a incluir:

- [ ] Informações gerais do raid
- [ ] Roteiro detalhado com pontos de paragem
- [ ] Lista de participantes e funções
- [ ] Formação em comboio (diagrama)
- [ ] Plano de contingência completo
- [ ] Contactos de emergência
- [ ] Guião de briefing
- [ ] Checklist do piloto (genérica ou por participante)
- [ ] Estatuto do clube (se activado nas configurações)
- [ ] Espaço para assinaturas de confirmação de participação

**Especificações do PDF gerado:**

- Logo e cor de destaque do clube incorporados automaticamente
- Cabeçalho com nome do clube, data e referência do documento
- Rodapé com número de páginas e nota de confidencialidade
- Formato A4, orientação vertical, fontes incorporadas
- Nome do ficheiro automático: `[NomeClube]_[NomeRaid]_[Data].pdf`
- Tempo de geração: < 8 segundos para raid com 10 participantes

---

## 8. Módulo 5 — Checklists Digitais

Cada participante confirma digitalmente a sua presença e preenche a checklist da sua moto antes do raid. O Capitão acompanha em tempo real quem confirmou.

### 8.1 Templates de Checklist

O clube define os seus templates com 3 categorias padrão (editáveis e extensíveis):

- **Mecânica** — óleo, pneus, travões, corrente, luzes, espelhos, fixação de bagagem
- **Equipamento Pessoal** — capacete, luvas, botas, colete, casaco, calças, roupa de chuva
- **Documentação** — carta de condução, registo, seguro, identificação, kit de emergência

### 8.2 Fluxo de Confirmação pelo Membro

1. Membro recebe notificação: *"Raid [Nome] confirmado. Confirma a tua presença."*
2. Clica no link → página do raid → botão **Confirmar Presença**
3. Selecciona qual o veículo que vai usar neste raid
4. Preenche a checklist item a item (checkbox interactivo)
5. Clica em **Submeter Confirmação**
6. Sistema regista timestamp; estado muda para Confirmado

### 8.3 Vista do Capitão

- Dashboard de confirmações: lista de membros com estado (`Pendente` / `Confirmado` / `Rejeitado`)
- Progresso visual: *"6 de 8 confirmados"*
- **Botão Enviar Lembrete** — notifica os pendentes
- Consulta da checklist de cada membro (o Capitão pode ver o que cada piloto confirmou)

---

## 9. Módulo 6 — Histórico e Estatísticas

### 9.1 Arquivo de Raids

- Todos os raids com estado `Concluído` ficam no arquivo
- Pesquisa por nome, destino, data, participante
- PDF de qualquer raid passado pode ser gerado novamente a qualquer momento
- Galeria de fotos por raid (upload após o raid)

### 9.2 Estatísticas do Clube

- Total de raids realizados
- Quilómetros totais percorridos pelo clube
- Mapa de calor dos destinos visitados
- Membro mais activo (por número de raids e km)
- Relatório anual exportável em PDF

### 9.3 Perfil Individual do Membro

- Raids participados (lista e contagem)
- KM acumulados em todos os raids
- Posições exercidas (líder, cauda, membro)
- Certificado de membro anual (PDF gerado automaticamente)

---

## 10. Arquitectura Multi-Clube e Personalização

### 10.1 Isolamento por Clube

Cada clube é um tenant completamente isolado. Nenhum dado, membro ou raid é partilhado entre clubes. O isolamento é garantido a nível de base de dados (`club_id` em todas as entidades, com Row-Level Security no PostgreSQL).

### 10.2 Onboarding de Novo Clube

1. Administrador regista o clube: nome, localidade, email de contacto
2. Recebe credenciais de acesso (email + password temporária)
3. É guiado por um wizard de configuração inicial:
   - Upload do logo
   - Escolha da cor de destaque
   - Preenchimento do estatuto (ou upload de PDF)
   - Definição dos valores padrão para raids
4. Convida os primeiros membros por email
5. Cria o primeiro raid

### 10.3 Planos e Limites

| Funcionalidade | Plano Gratuito | Plano Pro | Plano Clube+ |
|---|---|---|---|
| Membros | Até 15 | Ilimitado | Ilimitado |
| Raids activos em simultâneo | 2 | Ilimitado | Ilimitado |
| Exportação PDF | Sim (com marca d'água) | Sim (sem marca d'água) | Sim (personalizado) |
| Logo e cor do clube | Sim | Sim | Sim + 2.º logo |
| Estatuto em PDF | Não | Sim | Sim |
| Histórico e arquivo | 6 meses | Ilimitado | Ilimitado |
| Notificações email | Não | Sim | Sim + WhatsApp |
| Suporte | Comunidade | Email 48h | Dedicado 24h |

---

## 11. Stack Tecnológico

| Camada | Tecnologia | Justificação | Alternativa |
|---|---|---|---|
| Frontend | React + Vite + Tailwind CSS | SPA rápida, excelente ecossistema, mobile-first | Vue 3 |
| Backend | Node.js + Express | Full-stack JS, fácil de manter | NestJS |
| Base de dados | PostgreSQL | Relacional, multi-tenant com RLS, robusto | MySQL |
| ORM | Prisma | Type-safe, migrations automáticas, ótima DX | Drizzle |
| Autenticação | JWT + bcrypt | Stateless, simples, sem dependência externa | Clerk |
| Geração PDF | Puppeteer | HTML → PDF de alta fidelidade; respeita logo e cores do clube | PDFKit |
| Upload de ficheiros | Cloudinary | CDN global, tier gratuito generoso para logos e fotos | AWS S3 |
| Email | Resend | API simples, excelente entregabilidade | SendGrid |
| Deploy | Railway / Render | Zero DevOps, deploy automático do GitHub | VPS Hetzner |

---

## 12. Modelo de Dados

Todas as entidades têm `club_id` para garantir isolamento multi-tenant.

| Entidade | Campos Principais | Relações |
|---|---|---|
| `Club` | id, name, acronym, location, logo_url, accent_color, motto, statutes_text, default_settings_json | → Members, Raids, EmergencyContacts |
| `Member` | id, club_id, name, nickname, phone, emergency_contact, status, photo_url | → Club, Vehicles, Participations |
| `Vehicle` | id, member_id, brand, model, year, plate, type, photo_url | → Member |
| `Raid` | id, club_id, title, date, origin, destination, difficulty, km, status, description, settings_json | → RoutePoints, Participants, ContingencyPlan |
| `RoutePoint` | id, raid_id, order, name, type, hour, km_accum, stop_duration, notes | → Raid |
| `Participant` | id, raid_id, member_id, vehicle_id, role, confirmed_at, checklist_completed_at | → Raid, Member, Vehicle |
| `ChecklistItem` | id, participant_id, category, label, checked, checked_at | → Participant |
| `ContingencyPlan` | id, raid_id, accident_text, breakdown_text, separation_text, weather_text, rally_point, contacts_json | → Raid |
| `EmergencyContact` | id, club_id, region, name, role, phone | → Club |

---

## 13. Requisitos Não Funcionais

| Categoria | Requisito | Critério de Aceitação |
|---|---|---|
| Performance | Carregamento inicial da app | < 3 segundos em ligação 3G |
| Performance | Geração de PDF completo | < 8 segundos para raid com 10 participantes |
| Disponibilidade | Uptime do servidor | 99% mensal |
| Offline | Consulta de documentos em campo | PDF mais recente de cada raid acessível sem internet (PWA cache) |
| Segurança | Autenticação | JWT 24h + refresh token 30 dias; HTTPS obrigatório |
| Segurança | Isolamento multi-tenant | Nenhum utilizador acede a dados de outro clube; testado com testes de penetração |
| Privacidade | Dados de membros | Conformidade com LGPD / GDPR; dados eliminados em < 30 dias após pedido |
| Usabilidade | Mobile-first | 100% funcional em ecrã 375px; confirmação de presença feita em < 3 minutos no telemóvel |
| Localização | Idiomas | Português (PT e BR) no lançamento; arquitectura i18n para expansão |
| PDF | Fidelidade visual | Logo e cor do clube correctos; sem pixelização; fontes incorporadas |

---

## 14. Fluxos Principais de UX

### 14.1 Criar um Raid (Capitão de Estrada)

| # | Acção do Utilizador | Resposta do Sistema |
|---|---|---|
| 1 | Clica em **Novo Raid** (botão de destaque no topo da lista) | Abre assistente — Passo 1 de 4 com barra de progresso |
| 2 | Preenche nome, data, origem, destino, dificuldade | Valida campos obrigatórios em tempo real (inline) |
| 3 | Clica **Próximo** → Passo 2 | Barra de progresso actualiza; campos guardados |
| 4 | Clica **+ Adicionar Ponto** | Nova linha aparece na lista de pontos de rota |
| 5 | Preenche dados de cada ponto (nome, hora, km, notas) | KM acumulados calculados automaticamente |
| 6 | Clica **Próximo** → Passo 3 | Sistema guarda pontos e avança |
| 7 | Selecciona membros com checkbox; atribui funções no dropdown | Formação em comboio actualiza em tempo real |
| 8 | Clica **Próximo** → Passo 4 | Sistema avança para contingência e revisão |
| 9 | Revê e ajusta textos de contingência | Contactos de emergência sugeridos com base na rota |
| 10 | Clica **Publicar e Notificar Membros** | Raid criado; membros notificados; redirect para página de detalhe |
| 11 | Na página de detalhe, clica **Exportar PDF** | PDF gerado em < 8 seg com logo e cores do clube; download automático |

### 14.2 Confirmar Presença e Checklist (Membro)

1. Recebe notificação: *"Raid [Nome] — [Data]. Confirma a tua presença."*
2. Clica no link → página do raid (sem login se o link for público)
3. Lê o resumo: destino, data, pontos de rota, equipa
4. Clica em **Confirmar Presença**
5. Selecciona o veículo que vai usar
6. Preenche a checklist item a item no telemóvel
7. Clica **Submeter** — confirmação registada com timestamp
8. Capitão vê no dashboard: *"7 de 10 confirmados ✓"*

---

## 15. Roadmap de Desenvolvimento

| Fase | Duração | Entregáveis | Critério de Saída |
|---|---|---|---|
| **0 — Setup** | Semanas 1–2 | Repositório, CI/CD, design system, base de dados, autenticação, onboarding do primeiro clube | 1 clube registado e configurado com logo |
| **1 — MVP** | Semanas 3–9 | Config. clube, gestão de membros, criação de raid (wizard 4 passos), exportação PDF com logo e cor do clube | Raid completo criado e PDF gerado com identidade do clube |
| **2 — Confirmação** | Semanas 10–13 | Checklists digitais, confirmação de presença, notificações email, link público do raid | 100% dos membros de um raid de teste confirmam digitalmente |
| **3 — Histórico** | Semanas 14–18 | Arquivo de raids, estatísticas, galeria de fotos, relatório anual, certificado de membro | Clube piloto usa exclusivamente o sistema para gerir raids |
| **4 — Expansão** | Semanas 19+ | Multi-idioma (EN, FR), notificações WhatsApp Business, app mobile React Native, API pública | 2.º clube externo onboardado sem suporte |

---

## 16. Riscos e Mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Membros resistentes à adopção — preferência pelo WhatsApp | Alta | Alto | PDF exportável e partilhável por WhatsApp como ponte; onboarding de 5 min no telemóvel |
| 2 | Conectividade limitada em campo (países em desenvolvimento) | Alta | Médio | PWA com cache offline; último PDF guardado no dispositivo |
| 3 | Upload de logo em formato incorrecto (baixa qualidade no PDF) | Média | Médio | Validação do formato e resolução no upload; pré-visualização antes de guardar |
| 4 | Fuga de dados entre clubes (falha de isolamento multi-tenant) | Baixa | Crítico | Row-Level Security no PostgreSQL + testes de penetração antes do lançamento |
| 5 | Custo de Puppeteer (geração de PDF) em servidores de baixo custo | Média | Médio | Cache de templates PDF; geração em background queue; alternativa PDFKit para plano gratuito |

---

## 17. Glossário

| Termo | Definição |
|---|---|
| Raid | Passeio de moto em grupo organizado, com rota, paragens e regras de segurança pré-definidas |
| Capitão de Estrada | Membro responsável por organizar a rota e liderar o comboio |
| Cauda | Último piloto do comboio; garante que ninguém fica para trás |
| Comboio / Bonde | O grupo de motos em formação durante o raid |
| Formação Zíper | Disposição intercalada (moto à esquerda / moto à direita) para maior segurança em estrada |
| Briefing | Reunião rápida antes da partida para transmitir as regras e detalhes do raid |
| Multi-tenant | Arquitectura onde múltiplos clubes partilham a mesma aplicação com dados completamente isolados |
| PWA | Progressive Web App — aplicação web instalável no telemóvel, funciona offline |
| Puppeteer | Biblioteca Node.js que controla um browser headless para converter HTML em PDF |
| RLS | Row-Level Security — funcionalidade do PostgreSQL que restringe acesso a linhas por clube |
| i18n | Internacionalização — arquitectura que permite suporte a múltiplos idiomas |

---

*PRD-RAIDMANAGER-001 · v1.0 · Draft · Maio 2025*
