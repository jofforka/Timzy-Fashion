*{
  box-sizing:border-box;
  margin:0;
  padding:0;
}

:root{
  --bg:#08080a;
  --bg2:#101014;
  --card:rgba(22,22,28,0.82);
  --card-solid:#151518;
  --card2:#1b1b22;
  --border:rgba(255,255,255,0.09);
  --gold:#d9a441;
  --gold2:#f3c86a;
  --text:#f7f7f7;
  --muted:#a8a8ad;
  --green:#18c964;
  --red:#ff4d6d;
  --yellow:#ffb224;
  --blue:#6ea8ff;
  --shadow:0 22px 70px rgba(0,0,0,0.42);
}

body{
  min-height:100vh;
  background:
    radial-gradient(circle at top left,rgba(217,164,65,0.16),transparent 38%),
    radial-gradient(circle at top right,rgba(24,201,100,0.08),transparent 35%),
    linear-gradient(180deg,#08080a,#0d0d10 55%,#09090b);
  color:var(--text);
  font-family:Inter,Arial,sans-serif;
  line-height:1.5;
}

body::before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent 85%);
}

/* Typography */

.eyebrow{
  color:var(--gold2);
  font-size:12px;
  font-weight:900;
  letter-spacing:3px;
  text-transform:uppercase;
}

h1{
  font-size:clamp(32px,5vw,58px);
  line-height:1.05;
  margin:8px 0;
  font-weight:950;
}

h2{
  color:var(--gold2);
  margin-bottom:14px;
  font-size:clamp(23px,3vw,31px);
}

h3{
  margin:18px 0 12px;
}

p,.note,small{
  color:var(--muted);
}

a{
  color:var(--gold2);
}

/* Public storefront */

.public-header{
  display:grid;
  grid-template-columns:1.4fr auto;
  gap:24px;
  align-items:center;
  padding:38px 28px;
  border-bottom:1px solid var(--border);
  background:
    linear-gradient(135deg,rgba(217,164,65,0.14),rgba(0,0,0,0.1)),
    rgba(12,12,15,0.72);
  backdrop-filter:blur(16px);
}

.public-header p{
  max-width:760px;
}

.public-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.public-section{
  max-width:1400px;
  margin:28px auto;
  padding:0 18px 28px;
}

.section-head,
.dashboard-head{
  display:flex;
  justify-content:space-between;
  gap:18px;
  align-items:center;
  margin-bottom:18px;
}

/* Private hero */

.hero{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:20px;
  padding:34px 28px;
  background:
    radial-gradient(circle at top left,rgba(217,164,65,0.22),transparent 34%),
    rgba(13,13,16,0.72);
  border-bottom:1px solid var(--border);
  backdrop-filter:blur(16px);
}

.xp-card,
.system-badge{
  min-width:245px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:24px;
  padding:18px;
  box-shadow:var(--shadow);
  backdrop-filter:blur(16px);
}

.xp-card span,
.system-badge span,
.tech-card span{
  color:var(--muted);
  font-size:13px;
}

.xp-card strong,
.system-badge strong{
  display:block;
  font-size:34px;
  color:var(--text);
  margin-top:5px;
}

.system-badge strong{
  color:var(--green);
  letter-spacing:2px;
}

.bar{
  margin-top:12px;
  width:100%;
  height:10px;
  background:#2c2c32;
  border-radius:30px;
  overflow:hidden;
}

.bar i{
  display:block;
  height:100%;
  background:linear-gradient(90deg,var(--gold),var(--green));
}

/* Navigation */

nav{
  position:sticky;
  top:0;
  z-index:900;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:center;
  padding:14px;
  background:rgba(12,12,16,0.88);
  backdrop-filter:blur(18px);
  border-bottom:1px solid var(--border);
}

button,
.whatsapp-btn,
.form-card a{
  border:none;
  outline:none;
  cursor:pointer;
  border-radius:15px;
  padding:12px 16px;
  font-weight:900;
  transition:0.22s ease;
  background:linear-gradient(135deg,var(--gold2),var(--gold));
  color:#111;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
}

button:hover,
.whatsapp-btn:hover,
.form-card a:hover{
  transform:translateY(-2px);
  filter:brightness(1.06);
}

button:active{
  transform:scale(0.98);
}

.danger-btn{
  background:linear-gradient(135deg,#ff6b82,var(--red));
  color:white;
}

.whatsapp-btn{
  background:linear-gradient(135deg,#23e272,var(--green));
  color:#071108;
}

/* Layout */

main{
  max-width:1400px;
  margin:28px auto;
  padding:0 18px;
}

.tab{
  display:none;
}

.tab.active{
  display:block;
}

.cards,
.kpi-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
  gap:18px;
}

.card,
.tech-card,
.analytics-card,
.form-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:24px;
  padding:22px;
  box-shadow:var(--shadow);
  backdrop-filter:blur(16px);
}

.card strong,
.tech-card strong{
  display:block;
  margin-top:8px;
  font-size:clamp(26px,3vw,38px);
}

.tech-card{
  position:relative;
  overflow:hidden;
}

.tech-card::after{
  content:"";
  position:absolute;
  inset:auto 18px 0 18px;
  height:3px;
  background:linear-gradient(90deg,var(--gold),transparent);
  opacity:0.8;
}

.warning{
  border-color:rgba(255,77,109,0.35);
}

.warning::after{
  background:linear-gradient(90deg,var(--red),transparent);
}

/* Technical dashboard */

.analytics-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:18px;
  margin-top:18px;
}

.operations-grid{
  display:grid;
  grid-template-columns:1.2fr 0.8fr;
  gap:18px;
  margin-top:18px;
}

.chart-header{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:center;
  margin-bottom:12px;
}

.chart-header span{
  color:var(--gold2);
  font-size:12px;
  font-weight:800;
  text-transform:uppercase;
  letter-spacing:1px;
}

.chart-box{
  min-height:260px;
  background:linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.14));
  border:1px solid var(--border);
  border-radius:20px;
  padding:12px;
  overflow:hidden;
}

.chart-box canvas{
  width:100%;
  max-width:100%;
}

.chart-placeholder{
  min-height:230px;
  display:grid;
  place-items:center;
  text-align:center;
  color:var(--muted);
}

.chart-placeholder span{
  font-size:46px;
}

.activity-list{
  display:grid;
  gap:10px;
}

.activity-item{
  display:grid;
  gap:3px;
  padding:12px;
  border:1px solid var(--border);
  border-radius:16px;
  background:rgba(255,255,255,0.035);
}

.activity-item strong{
  color:var(--text);
}

.activity-item.danger{
  border-color:rgba(255,77,109,0.35);
}

/* Forms */

form{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:12px;
  margin-top:18px;
}

input,
select,
textarea{
  width:100%;
  padding:14px;
  border-radius:15px;
  border:1px solid var(--border);
  background:rgba(10,10,13,0.86);
  color:white;
  transition:0.2s ease;
}

textarea{
  min-height:96px;
  resize:vertical;
}

input:focus,
select:focus,
textarea:focus{
  border-color:var(--gold);
  outline:none;
  box-shadow:0 0 0 3px rgba(217,164,65,0.16);
}

/* Catalog */

.catalog-tools{
  display:grid;
  grid-template-columns:2fr 1fr;
  gap:12px;
  margin:18px 0;
}

.catalog-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(245px,1fr));
  gap:20px;
  margin-top:22px;
}

.catalog-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:26px;
  overflow:hidden;
  box-shadow:var(--shadow);
  backdrop-filter:blur(16px);
}

.catalog-image{
  height:255px;
  display:flex;
  justify-content:center;
  align-items:center;
  background:linear-gradient(135deg,#2a210e,#0b0b0d);
}

.catalog-image img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.catalog-image span{
  font-size:72px;
}

.catalog-body{
  padding:18px;
  display:grid;
  gap:9px;
}

.catalog-body h3{
  margin:0;
}

.catalog-body strong{
  color:var(--gold2);
  font-size:24px;
}

.catalog-body button,
.catalog-body .whatsapp-btn{
  width:100%;
}

/* Tables */

.table-wrap{
  overflow-x:auto;
  margin-top:18px;
  border-radius:20px;
  border:1px solid var(--border);
  background:var(--card);
  box-shadow:var(--shadow);
}

table{
  width:100%;
  border-collapse:collapse;
  min-width:900px;
}

th{
  background:rgba(255,255,255,0.055);
  color:var(--gold2);
  font-size:12px;
  text-transform:uppercase;
  letter-spacing:1px;
}

th,
td{
  padding:14px;
  border-bottom:1px solid var(--border);
  text-align:left;
  vertical-align:top;
}

tr:hover{
  background:rgba(255,255,255,0.035);
}

.status-rejected{
  color:var(--red);
  font-weight:900;
}

.status-approved{
  color:var(--green);
  font-weight:900;
}

.status-pending{
  color:var(--yellow);
  font-weight:900;
}

/* Leaderboard and forms */

.leaderboard,
.form-grid{
  display:grid;
  gap:14px;
}

.form-grid{
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
}

.rank-card{
  display:flex;
  justify-content:space-between;
  align-items:center;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  padding:18px;
}

.rank-card b{
  color:var(--gold2);
}

/* Modal */

.modal{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.78);
  z-index:2000;
  justify-content:center;
  align-items:center;
  padding:18px;
}

.modal-content{
  width:min(920px,100%);
  max-height:92vh;
  overflow-y:auto;
  background:rgba(18,18,23,0.96);
  border:1px solid var(--border);
  border-radius:26px;
  padding:24px;
  position:relative;
  box-shadow:0 30px 100px rgba(0,0,0,0.74);
  backdrop-filter:blur(18px);
}

.login-modal-card{
  width:min(440px,100%);
  display:grid;
  gap:14px;
}

.modal-close{
  position:absolute;
  top:14px;
  right:14px;
  padding:8px 14px;
  border-radius:50%;
}

.product-gallery{
  display:grid;
  grid-template-columns:1fr;
  gap:12px;
  margin:18px 0;
}

.product-gallery img{
  width:100%;
  max-height:650px;
  height:auto;
  object-fit:contain;
  background:#111;
  border-radius:18px;
  border:1px solid var(--border);
}

/* Chat */

.chat-box{
  margin-top:22px;
}

.chat-messages{
  background:rgba(10,10,13,0.86);
  border:1px solid var(--border);
  border-radius:16px;
  padding:14px;
  max-height:330px;
  overflow-y:auto;
  display:grid;
  gap:10px;
  margin:14px 0;
}

.chat-message{
  background:rgba(255,255,255,0.045);
  border:1px solid var(--border);
  padding:10px;
  border-radius:14px;
}

.chat-message strong{
  color:var(--gold2);
}

.chat-message.mine{
  border-color:rgba(24,201,100,0.55);
}

.chat-message.theirs{
  border-color:rgba(217,164,65,0.55);
}

.chat-input-row{
  display:grid;
  grid-template-columns:1fr auto;
  gap:10px;
}

footer{
  text-align:center;
  margin-top:45px;
  padding:30px;
  border-top:1px solid var(--border);
  color:var(--muted);
}

/* Mobile-first polish */

@media(max-width:980px){
  .public-header,
  .hero,
  .section-head,
  .dashboard-head{
    grid-template-columns:1fr;
    flex-direction:column;
    align-items:flex-start;
  }

  .public-actions{
    justify-content:flex-start;
    width:100%;
  }

  .analytics-grid,
  .operations-grid{
    grid-template-columns:1fr;
  }

  .xp-card,
  .system-badge{
    width:100%;
    min-width:0;
  }

  nav{
    justify-content:flex-start;
    overflow-x:auto;
    flex-wrap:nowrap;
    padding:10px;
  }

  nav button{
    white-space:nowrap;
    flex:none;
    width:auto;
  }
}

@media(max-width:700px){
  body{
    font-size:14px;
  }

  .public-header,
  .hero{
    padding:24px 16px;
  }

  main,
  .public-section{
    margin:18px auto;
    padding:0 12px;
  }

  .public-actions,
  .catalog-tools,
  .chat-input-row{
    grid-template-columns:1fr;
    flex-direction:column;
  }

  .public-actions button,
  .public-actions .whatsapp-btn{
    width:100%;
  }

  .cards,
  .kpi-grid,
  .catalog-grid,
  .form-grid{
    grid-template-columns:1fr;
  }

  .catalog-image{
    height:270px;
  }

  form{
    grid-template-columns:1fr;
  }

  input,
  select,
  textarea,
  button{
    font-size:15px;
  }

  table{
    min-width:760px;
    font-size:12px;
  }

  th,
  td{
    padding:10px;
  }

  .modal{
    align-items:flex-start;
    padding:10px;
  }

  .modal-content{
    width:100%;
    max-height:94vh;
    padding:18px;
    border-radius:20px;
  }

  .modal-close{
    top:8px;
    right:8px;
    width:38px;
    height:38px;
    padding:0;
  }

  .product-gallery img{
    max-height:75vh;
  }

  .chart-box{
    min-height:230px;
  }
}

@media(max-width:420px){
  .catalog-image{
    height:230px;
  }

  button,
  .whatsapp-btn,
  .form-card a{
    width:100%;
  }
}
