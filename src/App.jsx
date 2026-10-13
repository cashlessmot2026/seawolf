import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

/* =====================================================================
   Configuración
   ===================================================================== */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xetflthjncbypzigtsay.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGZsdGhqbmNieXB6aWd0c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTI0MjgsImV4cCI6MjEwNDIyODQyOH0.G1e01PJoqoKPxlzmgHvDwddy4PZBg15qoEc2lmmrsa8'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })

const BASE = import.meta.env.BASE_URL
const img = (p) => (/^(https?:|data:|blob:)/.test(p) ? p : BASE + p.replace(/^\//, ''))
const WHATSAPP = '+57 311 575 0547'
const WA_LINK = 'https://wa.me/573115750547'
const EMAIL = 'info@seawolfsai.com'
const POLL_MS = 8000

const TIPOS = {
  hotel: { label: 'Habitaciones', single: 'Alojamiento', unit: 'noche', cap: 'huéspedes', units: 'apartamentos' },
  embarcacion: { label: 'Embarcaciones', single: 'Embarcación', unit: 'persona', cap: 'cupos por día', units: '' },
  vehiculo: { label: 'Vehículos', single: 'Vehículo', unit: 'día', cap: 'puestos', units: 'unidades' }
}
const ESTADOS = ['pendiente', 'activo', 'usado', 'cancelado']

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const money = (n) => cop.format(Number(n) || 0)
const isoLocal = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d) }
const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000)
const fdate = (iso) => iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fdatetime = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const errMsg = (e) => (e?.message || String(e)).replace(/^.*?ERROR:\s*/, '')

const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }
}

/* Imágenes del sitio (empaquetadas en /public/img) */
const IM = {
  isla: 'img/i7.webp', velero: 'img/i3.webp', lancha: 'img/i6.webp', buceo: 'img/i12.webp', mulita: 'img/i13.webp',
  cuatri: 'img/i10.webp', yate: 'img/i14.webp', aerea: 'img/i11.webp', snorkel: 'img/i15.webp', palmas: 'img/i5.webp',
  arena: 'img/i9.webp', tienda: 'img/i8.webp', depto: 'img/i17.webp', terraza: 'img/i16.webp', mascota: 'img/i2.webp', logo: 'img/logo.png'
}

/* =====================================================================
   Router por hash (funciona en GitHub Pages y como PWA)
   ===================================================================== */
function useRoute() {
  const read = () => (window.location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0]
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
const go = (r) => { window.location.hash = '/' + r }

/* =====================================================================
   Sliders
   ===================================================================== */
function HeroSlider({ images, children, short, interval = 6000 }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % images.length), interval)
    return () => clearInterval(t)
  }, [images.length, interval, i])
  return (
    <section className={'hero' + (short ? ' short' : '')}>
      {images.map((src, k) => (
        <div key={src + k} className={'slide' + (k === i ? ' on' : '')} aria-hidden={k !== i}>
          <img src={img(src)} alt="" loading={k === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}
      <div className="wrap hero-copy">{children}</div>
      <div className="dots" style={{ '--dur': interval + 'ms' }}>
        {images.map((_, k) => (
          <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={'Imagen ' + (k + 1)} />
        ))}
      </div>
    </section>
  )
}

function MiniSlider({ images = [], interval = 4200, auto = true }) {
  const list = images.length ? images : [IM.isla]
  const [i, setI] = useState(0)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    if (!auto || hover || list.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % list.length), interval + Math.random() * 900)
    return () => clearInterval(t)
  }, [auto, hover, list.length, interval])
  const step = (d, e) => { e.preventDefault(); e.stopPropagation(); setI((x) => (x + d + list.length) % list.length) }
  return (
    <div className="mini" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {list.map((src, k) => <img key={k} src={img(src)} alt="" loading="lazy" />)}
      </div>
      {list.length > 1 && (
        <>
          <div className="pips">{list.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
          <button className="arrow l" onClick={(e) => step(-1, e)} aria-label="Anterior">‹</button>
          <button className="arrow r" onClick={(e) => step(1, e)} aria-label="Siguiente">›</button>
        </>
      )}
    </div>
  )
}

/* =====================================================================
   Datos
   ===================================================================== */
function useCatalog() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await sb.from('sw_catalogo').select('*').order('orden')
    if (error) setError(errMsg(error)); else { setItems(data); setError('') }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  return { items, loading, error, reload: load }
}

/* =====================================================================
   Layout público
   ===================================================================== */
function Header({ route }) {
  const [open, setOpen] = useState(false)
  const links = [
    ['inicio', 'Inicio'], ['experiencias', 'Seawolf Xperiencias'], ['alojamientos', 'Seawolf Alojamientos'],
    ['nosotros', 'Sobre Nosotros'], ['mi-reserva', 'Mi reserva']
  ]
  return (
    <>
      <div className="promo"><span>Reserva en línea y recibe tu código QR al instante · Alojamientos, embarcaciones y vehículos en San Andrés · Paga por WhatsApp {WHATSAPP} y activamos tu QR</span></div>
      <header className="header">
        <div className="wrap" style={{ position: 'relative' }}>
          <a className="brand" href="#/inicio" onClick={() => setOpen(false)}>
            <img src={img(IM.logo)} alt="" /><b>SEAWOLF</b>
          </a>
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Menú" aria-expanded={open}><span /><span /><span /></button>
          <nav className={'nav' + (open ? ' open' : '')} onClick={() => setOpen(false)}>
            {links.map(([r, t]) => <a key={r} href={'#/' + r} className={route === r ? 'on' : ''}>{t}</a>)}
            <a href="https://www.seawolfsai.com/shop" target="_blank" rel="noreferrer">Seawolf Shop</a>
            <a className="btn small" href="#/experiencias">Reservar ahora</a>
          </nav>
        </div>
      </header>
    </>
  )
}

function Newsletter() {
  const [sent, setSent] = useState(false)
  return (
    <section className="section dark">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Mantente navegando · @seawolfsai</span>
          <h2>Conoce nuestros descuentos antes que todos</h2>
        </div>
        {sent ? <p style={{ fontSize: '1.1rem' }}>Listo. Te escribiremos con las próximas promociones.</p> : (
          <form className="news" onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
            <div className="field"><label htmlFor="nl-n">Nombre</label><input id="nl-n" className="input" required /></div>
            <div className="field"><label htmlFor="nl-a">Apellido</label><input id="nl-a" className="input" /></div>
            <div className="field"><label htmlFor="nl-e">Email</label><input id="nl-e" type="email" className="input" required /></div>
            <div className="field"><label htmlFor="nl-b">Cumpleaños</label><input id="nl-b" type="date" className="input" /></div>
            <button className="btn" type="submit">Suscribirme</button>
          </form>
        )}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <h4>Seawolf SAI</h4>
            <p>Avenida Colombia, Edificio Comodore, Local 3<br />San Andrés, San Andrés y Providencia</p>
          </div>
          <div>
            <h4>Contacto</h4>
            <a href={'mailto:' + EMAIL}>{EMAIL}</a>
            <a href={WA_LINK} target="_blank" rel="noreferrer">Tel / WhatsApp: {WHATSAPP}</a>
            <a href="https://instagram.com/seawolfsai" target="_blank" rel="noreferrer">Instagram @seawolfsai</a>
          </div>
          <div>
            <h4>Explora</h4>
            <a href="#/experiencias">Seawolf Xperiencias</a>
            <a href="#/alojamientos">Seawolf Alojamientos</a>
            <a href="#/nosotros">Sobre Nosotros</a>
            <a href="#/mi-reserva">Consultar mi reserva</a>
          </div>
          <div>
            <h4>Tienda</h4>
            <a href="https://www.seawolfsai.com/shop" target="_blank" rel="noreferrer">Seawolf Shop</a>
            <a href="https://www.seawolfsai.com/gift-card" target="_blank" rel="noreferrer">Tarjetas de regalo</a>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} Seawolf SAI · Turismo responsable en San Andrés isla</span>
          <span><a href="#/staff" style={{ display: 'inline' }}>Acceso personal</a></span>
        </div>
      </div>
    </footer>
  )
}

/* =====================================================================
   Páginas públicas
   ===================================================================== */
function Home({ onBook, catalog }) {
  const cats = [
    { to: 'experiencias?vehiculo', title: 'Vehículos', text: 'Mulitas, cuatrimotos y más para darle la vuelta a la isla a tu propio ritmo.', cta: 'Recorre la isla', imgs: [IM.mulita, IM.cuatri] },
    { to: 'alojamientos', title: 'Alojamientos', text: 'Apartamentos y casas con la comodidad y la calidez que se sienten en San Andrés.', cta: 'Ver disponibilidad', imgs: [IM.depto, IM.terraza, IM.palmas] },
    { to: 'experiencias', title: 'Experiencias', text: 'Tours a los cayos, pesca, snorkel y atardeceres a bordo con tripulación local.', cta: 'Descubre tu aventura', imgs: [IM.lancha, IM.buceo, IM.yate, IM.velero] }
  ]
  const destacados = catalog.items.filter((x) => x.activo).slice(0, 3)
  return (
    <>
      <HeroSlider images={[IM.isla, IM.lancha, IM.velero, IM.buceo, IM.mulita]}>
        <span className="eyebrow" style={{ color: 'var(--aqua)' }}>San Andrés isla · Caribe colombiano</span>
        <h1>Aventuras inolvidables y <em>momentos únicos</em></h1>
        <p>Alojamiento, mar y carretera en un solo lugar. Reserva en minutos y lleva tu entrada en un código QR.</p>
        <div className="cta">
          <a className="btn" href="#/experiencias">Reservar experiencia</a>
          <a className="btn light" href="#/alojamientos">Ver alojamientos</a>
        </div>
      </HeroSlider>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Experiencias integrales</span>
            <h2>Todo lo que necesitas para vivir la isla</h2>
            <p className="muted">Un portafolio pensado para conectar con la esencia isleña, con atención cercana y estándares de seguridad.</p>
          </div>
          <div className="grid3">
            {cats.map((c) => (
              <a key={c.title} className="cat" href={'#/' + c.to}>
                <MiniSlider images={c.imgs} />
                <div className="body">
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <span className="btn small" style={{ justifySelf: 'start' }}>{c.cta}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {destacados.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="section-head"><span className="eyebrow">Para reservar hoy</span><h2>Destacados</h2></div>
            <div className="cards">{destacados.map((it) => <ItemCard key={it.id} item={it} onBook={onBook} />)}</div>
          </div>
        </section>
      )}

      <section className="section dark">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Síguenos en Instagram</span>
            <h2>@seawolfsai</h2>
          </div>
          <div className="strip">
            {[IM.aerea, IM.snorkel, IM.palmas, IM.tienda, IM.arena, IM.yate].map((s) => <img key={s} src={img(s)} alt="" loading="lazy" />)}
          </div>
          <div style={{ marginTop: 28 }}><a className="btn" href="https://instagram.com/seawolfsai" target="_blank" rel="noreferrer">Ver más</a></div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <MiniSlider images={[IM.tienda, IM.mascota]} />
          <div className="copy">
            <span className="eyebrow">¡Visítanos!</span>
            <h2>Nuestra tienda en el centro</h2>
            <p>Avenida Colombia, Edificio Comodore, Local 3. Pasa por tu ropa Seawolf, resuelve dudas de tu reserva o paga tu experiencia en persona.</p>
            <div><a className="btn" href={WA_LINK} target="_blank" rel="noreferrer">Escríbenos por WhatsApp</a></div>
          </div>
        </div>
      </section>
    </>
  )
}

function About() {
  return (
    <>
      <HeroSlider short images={[IM.palmas, IM.isla, IM.arena, IM.snorkel]}>
        <span className="eyebrow" style={{ color: 'var(--aqua)' }}>Sobre nosotros</span>
        <h1>Turismo auténtico, <em>compromiso isleño</em></h1>
      </HeroSlider>
      <section className="section">
        <div className="wrap split">
          <div className="copy">
            <span className="eyebrow">Quiénes somos</span>
            <h2>Una agencia local que muestra San Andrés desde adentro</h2>
            <p>Seawolf SAI nace en la isla. Diseñamos experiencias seguras y de calidad que respetan la cultura raizal y cuidan el mar que nos rodea.</p>
            <p>Queremos que cada visitante se lleve la isla real: su gente, su comida, sus cayos y sus atardeceres, y que su viaje deje algo bueno en el territorio.</p>
            <div><a className="btn" href="#/experiencias">Reserva tu experiencia</a></div>
          </div>
          <MiniSlider images={[IM.mascota, IM.velero, IM.buceo, IM.tienda]} />
        </div>
      </section>
      <section className="section dark">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Lo que nos mueve</span>
            <h2>Descubre San Andrés de una manera única</h2>
            <p className="muted">Únete a una comunidad de viajeros que valora la cultura isleña y la protección del entorno marino. Con Seawolf no solo viajas: ayudas a preservar la esencia de la isla.</p>
          </div>
          <div className="pillars">
            <div className="pillar"><h3>Cultura isleña</h3><p className="muted">Guías y tripulaciones locales que comparten la historia y las tradiciones del archipiélago.</p></div>
            <div className="pillar"><h3>Sostenibilidad</h3><p className="muted">Grupos de tamaño responsable, cero plástico a bordo y respeto por los arrecifes.</p></div>
            <div className="pillar"><h3>Seguridad</h3><p className="muted">Embarcaciones y vehículos revisados, chalecos y acompañamiento en cada salida.</p></div>
            <div className="pillar"><h3>Recuerdos</h3><p className="muted">Experiencias pensadas para familias, parejas o viajeros solos, con atención de principio a fin.</p></div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="section-head"><span className="eyebrow">Preguntas frecuentes</span><h2>Antes de reservar</h2></div>
          <Faq />
        </div>
      </section>
    </>
  )
}

function Faq() {
  const qs = [
    ['¿Cómo funciona el código QR?', 'Al reservar recibes un QR único. Queda pendiente hasta que confirmamos tu pago; entonces lo activamos y nuestro equipo lo escanea el día de tu servicio.'],
    ['¿Cómo pago?', `Escríbenos por WhatsApp al ${WHATSAPP} con tu código de reserva. Te enviamos los datos de pago y activamos el QR al confirmar.`],
    ['¿Puedo consultar el estado de mi reserva?', 'Sí. En “Mi reserva” escribe tu código y verás si tu QR ya está activo.'],
    ['¿Qué necesito para alquilar un vehículo?', 'Licencia de conducción vigente y documento de identidad. Los menores no pueden conducir.']
  ]
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 820 }}>
      {qs.map(([q, a]) => (
        <details key={q} className="panel" style={{ cursor: 'pointer' }}>
          <summary style={{ fontWeight: 600 }}>{q}</summary>
          <p className="muted" style={{ marginTop: 8 }}>{a}</p>
        </details>
      ))}
    </div>
  )
}

function ItemCard({ item, onBook }) {
  const t = TIPOS[item.tipo]
  return (
    <article className="card">
      <MiniSlider images={item.imagenes} />
      <div className="info">
        <span className="eyebrow">{t.single}</span>
        <h3>{item.nombre}</h3>
        <p className="muted" style={{ fontSize: '.92rem' }}>{item.descripcion}</p>
        <div className="meta">
          <span className="chip">{item.capacidad} {t.cap}</span>
          {item.tipo !== 'embarcacion' && <span className="chip">{item.unidades} {t.units}</span>}
        </div>
        <div className="foot">
          <span className="price num">{money(item.precio)} <small>/ {t.unit}</small></span>
          <button className="btn small" onClick={() => onBook(item)}>Reservar</button>
        </div>
      </div>
    </article>
  )
}

function Catalogo({ tipos, catalog, onBook, initial }) {
  const [tab, setTab] = useState(initial && tipos.includes(initial) ? initial : tipos[0])
  const list = catalog.items.filter((x) => x.activo && x.tipo === tab)
  return (
    <>
      {tipos.length > 1 && (
        <div className="tabs" role="tablist">
          {tipos.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{TIPOS[t].label}</button>)}
        </div>
      )}
      {catalog.loading ? <p className="muted">Cargando servicios…</p>
        : catalog.error ? <p className="err">No pudimos cargar los servicios: {catalog.error}</p>
          : list.length === 0 ? <p className="muted">No hay servicios publicados en esta categoría por ahora.</p>
            : <div className="cards">{list.map((it) => <ItemCard key={it.id} item={it} onBook={onBook} />)}</div>}
    </>
  )
}

function Experiencias({ catalog, onBook }) {
  const initial = window.location.hash.split('?')[1]
  return (
    <>
      <HeroSlider short images={[IM.yate, IM.mulita, IM.snorkel, IM.cuatri, IM.aerea]}>
        <span className="eyebrow" style={{ color: 'var(--aqua)' }}>Seawolf Xperiencias</span>
        <h1>Transforma San Andrés en <em>la aventura de tu vida</em></h1>
      </HeroSlider>
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Nuestros servicios</span>
            <h2>Elige cómo quieres recorrer la isla</h2>
            <p className="muted">En el mar con tripulación experta o en tierra con nuestras mulitas y cuatrimotos. Reserva, recibe tu QR y paga cuando quieras.</p>
          </div>
          <Catalogo tipos={['embarcacion', 'vehiculo']} catalog={catalog} onBook={onBook} initial={initial} />
        </div>
      </section>
    </>
  )
}

function Alojamientos({ catalog, onBook }) {
  return (
    <>
      <HeroSlider short images={[IM.depto, IM.terraza, IM.palmas, IM.isla]}>
        <span className="eyebrow" style={{ color: 'var(--aqua)' }}>Seawolf Alojamientos</span>
        <h1>Tu descanso en el Caribe <em>comienza aquí</em></h1>
      </HeroSlider>
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Navega con nosotros</span>
            <h2>Apartamentos y casas en el centro de la isla</h2>
            <p className="muted">Precios por noche para el alojamiento completo. La disponibilidad se revisa en tiempo real al elegir tus fechas.</p>
          </div>
          <Catalogo tipos={['hotel']} catalog={catalog} onBook={onBook} />
        </div>
      </section>
    </>
  )
}

/* =====================================================================
   Reserva + QR
   ===================================================================== */
function useQr(text, size = 320) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!text) return
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b2e2b', light: '#ffffff' } })
      .then(setUrl).catch(() => setUrl(''))
  }, [text, size])
  return url
}

function Ticket({ r }) {
  const qr = useQr(r.codigo)
  const t = TIPOS[r.tipo] || TIPOS.hotel
  return (
    <div className="ticket">
      <span className={'state ' + r.estado}>{r.estado === 'pendiente' ? 'Pendiente de pago' : r.estado}</span>
      <div className="qr">{qr ? <img src={qr} alt={'Código QR ' + r.codigo} /> : <div style={{ width: 220, height: 220 }} />}</div>
      <div className="code">{r.codigo}</div>
      <div className="summary" style={{ width: '100%', textAlign: 'left' }}>
        <div className="row"><span>{t.single}</span><b>{r.item_nombre}</b></div>
        <div className="row"><span>Fechas</span><span>{fdate(r.fecha_inicio)}{r.fecha_fin && r.fecha_fin !== r.fecha_inicio ? ' → ' + fdate(r.fecha_fin) : ''}</span></div>
        <div className="row"><span>Personas</span><span className="num">{r.personas}{r.tipo === 'vehiculo' ? ` · ${r.cantidad} unidad(es)` : ''}</span></div>
        <div className="row total"><span>Total</span><span className="num">{money(r.total)}</span></div>
      </div>
      {r.estado === 'pendiente' && (
        <p className="muted" style={{ fontSize: '.9rem' }}>
          Para activar tu QR envía este código por WhatsApp al <b>{WHATSAPP}</b>. Al confirmar tu pago lo activamos y queda listo para el día de tu servicio.
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {qr && <a className="btn small" href={qr} download={r.codigo + '.png'}>Descargar QR</a>}
        <a className="btn small light" href={`${WA_LINK}?text=${encodeURIComponent('Hola Seawolf, quiero pagar mi reserva ' + r.codigo)}`} target="_blank" rel="noreferrer">Pagar por WhatsApp</a>
      </div>
    </div>
  )
}

function BookingModal({ item, onClose }) {
  const t = TIPOS[item.tipo]
  const today = isoLocal()
  const [f, setF] = useState({
    fecha_inicio: addDays(today, 1),
    fecha_fin: item.tipo === 'hotel' ? addDays(today, 3) : addDays(today, 1),
    personas: 2, cantidad: 1, nombre: '', email: '', telefono: '', ciudad: '', notas: ''
  })
  const [libre, setLibre] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const fin = item.tipo === 'embarcacion' ? f.fecha_inicio : f.fecha_fin
  const dias = item.tipo === 'hotel' ? diffDays(f.fecha_inicio, fin) : diffDays(f.fecha_inicio, fin) + 1
  const total = item.tipo === 'hotel' ? item.precio * Math.max(dias, 0)
    : item.tipo === 'embarcacion' ? item.precio * (+f.personas || 0)
      : item.precio * Math.max(dias, 0) * (+f.cantidad || 0)

  useEffect(() => {
    let live = true
    setLibre(null)
    if (!f.fecha_inicio || !fin || fin < f.fecha_inicio) return
    const t = setTimeout(async () => {
      const { data } = await sb.rpc('sw_disponible', { p_item: item.id, p_ini: f.fecha_inicio, p_fin: fin })
      if (live) setLibre(data ?? null)
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [item.id, f.fecha_inicio, fin])

  const need = item.tipo === 'embarcacion' ? +f.personas : item.tipo === 'vehiculo' ? +f.cantidad : 1
  const ok = libre == null || libre >= need

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (item.tipo === 'hotel' && dias < 1) return setError('La salida debe ser al menos una noche después de la llegada.')
    if (item.tipo === 'vehiculo' && dias < 1) return setError('La fecha de devolución no puede ser anterior a la de recogida.')
    setBusy(true)
    const { data, error } = await sb.rpc('sw_crear_reserva', { p: { ...f, fecha_fin: fin, item_id: item.id } })
    setBusy(false)
    if (error) return setError(errMsg(error))
    const r = { ...data, tipo: item.tipo }
    const mine = ls.get('sw_mis_reservas', [])
    ls.set('sw_mis_reservas', [r.codigo, ...mine.filter((c) => c !== r.codigo)].slice(0, 20))
    setDone(r)
  }

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={'Reservar ' + item.nombre}>
        <div className="side"><MiniSlider images={item.imagenes} /></div>
        <div className="main">
          <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
          {done ? (
            <>
              <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
                <span className="eyebrow">Reserva creada</span>
                <h2 style={{ fontSize: '1.7rem' }}>¡Gracias, {done.nombre.split(' ')[0]}!</h2>
              </div>
              <Ticket r={done} />
            </>
          ) : (
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span className="eyebrow">Reservar · {t.single}</span>
                <h2 style={{ fontSize: '1.6rem' }}>{item.nombre}</h2>
                <span className="muted num">{money(item.precio)} por {t.unit}</span>
              </div>
              <div className="form2">
                <div className="field">
                  <label htmlFor="b-ini">{item.tipo === 'hotel' ? 'Llegada' : item.tipo === 'vehiculo' ? 'Recogida' : 'Fecha de salida'}</label>
                  <input id="b-ini" type="date" className="input" min={today} value={f.fecha_inicio} onChange={set('fecha_inicio')} required />
                </div>
                {item.tipo !== 'embarcacion' && (
                  <div className="field">
                    <label htmlFor="b-fin">{item.tipo === 'hotel' ? 'Salida' : 'Devolución'}</label>
                    <input id="b-fin" type="date" className="input" min={f.fecha_inicio} value={f.fecha_fin} onChange={set('fecha_fin')} required />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="b-per">Personas</label>
                  <input id="b-per" type="number" className="input" min="1" max={item.tipo === 'embarcacion' ? libre ?? item.capacidad : item.capacidad * (+f.cantidad || 1)} value={f.personas} onChange={set('personas')} required />
                </div>
                {item.tipo === 'vehiculo' && (
                  <div className="field">
                    <label htmlFor="b-cant">Unidades</label>
                    <input id="b-cant" type="number" className="input" min="1" max={item.unidades} value={f.cantidad} onChange={set('cantidad')} required />
                  </div>
                )}
                <div className="full">
                  {libre == null ? <span className="avail muted">Consultando disponibilidad…</span>
                    : <span className={'avail ' + (ok ? 'ok' : 'no')}>
                      {item.tipo === 'embarcacion' ? `${libre} cupos libres ese día` : `${libre} ${t.units} libres en esas fechas`}
                    </span>}
                </div>
                <div className="field full"><label htmlFor="b-nom">Nombre completo</label><input id="b-nom" className="input" value={f.nombre} onChange={set('nombre')} required autoComplete="name" /></div>
                <div className="field"><label htmlFor="b-tel">WhatsApp / teléfono</label><input id="b-tel" type="tel" className="input" value={f.telefono} onChange={set('telefono')} required autoComplete="tel" /></div>
                <div className="field"><label htmlFor="b-mail">Email</label><input id="b-mail" type="email" className="input" value={f.email} onChange={set('email')} autoComplete="email" /></div>
                <div className="field full"><label htmlFor="b-city">Ciudad de origen</label><input id="b-city" className="input" value={f.ciudad} onChange={set('ciudad')} required placeholder="Bogotá, Medellín, Cali…" /></div>
                <div className="field full"><label htmlFor="b-notas">Notas (opcional)</label><textarea id="b-notas" className="input" rows="2" value={f.notas} onChange={set('notas')} /></div>
              </div>
              <div className="summary">
                {item.tipo === 'hotel' && <div className="row"><span>{Math.max(dias, 0)} noche(s) × {money(item.precio)}</span></div>}
                {item.tipo === 'embarcacion' && <div className="row"><span>{f.personas || 0} persona(s) × {money(item.precio)}</span></div>}
                {item.tipo === 'vehiculo' && <div className="row"><span>{Math.max(dias, 0)} día(s) × {f.cantidad || 0} unidad(es) × {money(item.precio)}</span></div>}
                <div className="row total"><span>Total estimado</span><span className="num">{money(total)}</span></div>
              </div>
              {error && <p className="err" role="alert">{error}</p>}
              <button className="btn" type="submit" disabled={busy || !ok}>{busy ? 'Creando reserva…' : 'Confirmar y generar QR'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function MiReserva() {
  const [code, setCode] = useState('')
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')
  const mine = ls.get('sw_mis_reservas', [])
  async function lookup(c) {
    setError(''); setRes(null)
    const { data, error } = await sb.rpc('sw_validar_qr', { p_codigo: c })
    if (error) return setError(errMsg(error))
    if (!data) return setError('No encontramos una reserva con ese código. Revisa que esté completo, por ejemplo SW-1A2B3C4D5E.')
    setRes(data)
  }
  return (
    <section className="section">
      <div className="wrap validator">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="eyebrow">Mi reserva</span>
          <h2>Consulta tu QR</h2>
          <p className="muted">Escribe el código que recibiste al reservar para ver su estado y descargar el QR.</p>
        </div>
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); lookup(code) }}>
          <input id="mr-code" className="input" placeholder="SW-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          <button className="btn" type="submit">Consultar</button>
        </form>
        {mine.length > 0 && (
          <div className="tabs" style={{ marginBottom: 0 }}>
            <span className="muted" style={{ fontSize: '.84rem', alignSelf: 'center' }}>Reservas en este dispositivo:</span>
            {mine.map((c) => <button key={c} className="tab" onClick={() => { setCode(c); lookup(c) }}>{c}</button>)}
          </div>
        )}
        {error && <p className="err">{error}</p>}
        {res && <div className="panel"><Ticket r={res} /></div>}
      </div>
    </section>
  )
}

/* =====================================================================
   Personal: validar QR
   ===================================================================== */
function Scanner({ onCode }) {
  const video = useRef(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let stream, raf, stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        video.current.srcObject = stream
        await video.current.play()
        const tick = () => {
          const v = video.current
          if (!v || stopped) return
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            const q = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
            if (q?.data) { onCode(q.data.trim()); return }
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setErr('No se pudo abrir la cámara. Revisa el permiso del navegador o escribe el código.')
      }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()) }
  }, [onCode])
  return err ? <p className="err">{err}</p> : (
    <div className="scan"><video ref={video} playsInline muted /><div className="frame" /><div className="laser" /></div>
  )
}

function decodeFile(file) {
  return new Promise((resolve) => {
    const im = new Image()
    im.onload = () => {
      const c = document.createElement('canvas')
      const s = Math.min(1, 1200 / Math.max(im.width, im.height))
      c.width = im.width * s; c.height = im.height * s
      const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, c.width, c.height)
      resolve(jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data || null)
      URL.revokeObjectURL(im.src)
    }
    im.onerror = () => resolve(null)
    im.src = URL.createObjectURL(file)
  })
}

function Staff() {
  const [code, setCode] = useState('')
  const [scan, setScan] = useState(false)
  const [res, setRes] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const check = useCallback(async (c) => {
    const val = (c || '').toUpperCase().trim()
    setScan(false); setCode(val); setError(''); setRes(undefined)
    if (!val) return
    const { data, error } = await sb.rpc('sw_validar_qr', { p_codigo: val })
    if (error) return setError(errMsg(error))
    setRes(data || null)
    if (navigator.vibrate) navigator.vibrate(data?.estado === 'activo' ? 80 : [60, 60, 60])
  }, [])
  async function checkin() {
    setBusy(true)
    const { data, error } = await sb.rpc('sw_registrar_ingreso', { p_codigo: res.codigo })
    setBusy(false)
    if (error) return setError(errMsg(error))
    setRes(data)
  }
  const label = { activo: 'QR ACTIVO', pendiente: 'PAGO PENDIENTE', usado: 'YA UTILIZADO', cancelado: 'CANCELADO' }
  const note = {
    activo: 'Pago confirmado. Puedes dar acceso al servicio.',
    pendiente: 'El administrador aún no ha confirmado el pago. No des acceso.',
    usado: 'Este QR ya registró su ingreso.',
    cancelado: 'Reserva cancelada. No des acceso.'
  }
  return (
    <section className="section">
      <div className="wrap validator">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="eyebrow">Personal Seawolf</span>
          <h2>Validar QR</h2>
          <p className="muted">Escanea el QR del cliente con la cámara, sube una foto del código o escríbelo.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => { setRes(undefined); setScan((s) => !s) }}>{scan ? 'Cerrar cámara' : 'Escanear con cámara'}</button>
          <label className="btn light" htmlFor="st-file" style={{ cursor: 'pointer' }}>Subir foto del QR</label>
          <input id="st-file" type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            const c = await decodeFile(f)
            c ? check(c) : setError('No se encontró un QR legible en la foto. Intenta con más luz o escribe el código.')
          }} />
        </div>
        {scan && <Scanner onCode={check} />}
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); check(code) }}>
          <input id="st-code" className="input" placeholder="SW-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn ghost" type="submit">Validar código</button>
        </form>
        {error && <p className="err">{error}</p>}
        {res === null && <div className="verdict none"><h2>NO EXISTE</h2><p>No hay ninguna reserva con el código {code}.</p></div>}
        {res && (
          <>
            <div className={'verdict ' + res.estado}>
              <h2>{label[res.estado]}</h2>
              <p>{note[res.estado]}</p>
            </div>
            <div className="summary">
              <div className="row"><span>Código</span><b className="code" style={{ fontSize: '1rem' }}>{res.codigo}</b></div>
              <div className="row"><span>Cliente</span><b>{res.nombre}</b></div>
              <div className="row"><span>Servicio</span><span>{res.item_nombre}</span></div>
              <div className="row"><span>Fechas</span><span>{fdate(res.fecha_inicio)}{res.fecha_fin !== res.fecha_inicio ? ' → ' + fdate(res.fecha_fin) : ''}</span></div>
              <div className="row"><span>Personas</span><span className="num">{res.personas}{res.tipo === 'vehiculo' ? ` · ${res.cantidad} unidad(es)` : ''}</span></div>
              {res.usado && <div className="row"><span>Ingreso registrado</span><span>{fdatetime(res.usado)}</span></div>}
            </div>
            {res.estado === 'activo' && <button className="btn ok" onClick={checkin} disabled={busy}>{busy ? 'Registrando…' : 'Registrar ingreso'}</button>}
          </>
        )}
      </div>
    </section>
  )
}

/* =====================================================================
   Admin (oculto en #/admin, contraseña verificada en Supabase)
   ===================================================================== */
function beep(ctx) {
  if (!ctx) return
  try {
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + 0.15)
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.5)
  } catch { /* audio no disponible */ }
}

function Admin() {
  const [pass, setPass] = useState(() => { try { return sessionStorage.getItem('sw_admin') || '' } catch { return '' } })
  const [ok, setOk] = useState(false)
  const [checking, setChecking] = useState(!!pass)
  const audio = useRef(null)

  useEffect(() => {
    if (!pass) return
    sb.rpc('sw_admin_login', { p_pass: pass }).then(({ data }) => { setOk(!!data); setChecking(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) return <div className="login"><p style={{ color: '#fff' }}>Verificando acceso…</p></div>
  if (!ok) return <AdminLogin onOk={(p) => {
    try { sessionStorage.setItem('sw_admin', p) } catch { /* sin almacenamiento */ }
    try { audio.current = new (window.AudioContext || window.webkitAudioContext)() } catch { /* sin audio */ }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    setPass(p); setOk(true)
  }} />
  return <Dashboard pass={pass} audio={audio} onLogout={() => { try { sessionStorage.removeItem('sw_admin') } catch { /* */ } setOk(false); setPass('') }} />
}

function AdminLogin({ onOk }) {
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="login">
      <form onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr('')
        const { data, error } = await sb.rpc('sw_admin_login', { p_pass: p })
        setBusy(false)
        if (error) return setErr(errMsg(error))
        data ? onOk(p) : setErr('Contraseña incorrecta.')
      }}>
        <img src={img(IM.logo)} alt="" />
        <h2 style={{ fontSize: '1.5rem' }}>Panel administrativo</h2>
        <div className="field" style={{ textAlign: 'left' }}>
          <label htmlFor="ad-pass">Contraseña</label>
          <input id="ad-pass" type="password" className="input" value={p} onChange={(e) => setP(e.target.value)} autoFocus required />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <a href="#/inicio" className="muted" style={{ fontSize: '.85rem' }}>Volver al sitio</a>
      </form>
    </div>
  )
}

function Dashboard({ pass, audio, onLogout }) {
  const [tab, setTab] = useState('resumen')
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState([])
  const [fresh, setFresh] = useState(() => new Set())
  const [unseen, setUnseen] = useState({ hotel: 0, embarcacion: 0, vehiculo: 0 })
  const known = useRef(null)
  const catalog = useCatalog()

  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('sw_admin_reservas', { p_pass: pass })
    if (error) { setError(errMsg(error)); return }
    setError('')
    if (known.current) {
      const nuevas = data.filter((r) => !known.current.has(r.id))
      if (nuevas.length) {
        beep(audio.current)
        setToasts((t) => [...nuevas.map((r) => ({ id: r.id, r })), ...t].slice(0, 5))
        setFresh((s) => new Set([...s, ...nuevas.map((r) => r.id)]))
        setUnseen((u) => { const n = { ...u }; nuevas.forEach((r) => { n[r.tipo] = (n[r.tipo] || 0) + 1 }); return n })
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          nuevas.forEach((r) => { try { new Notification('Nueva reserva · Seawolf', { body: `${r.nombre} · ${r.item_nombre} · ${money(r.total)}`, icon: img('icon-192.png') }) } catch { /* */ } })
        }
        nuevas.forEach((r) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== r.id)), 12000))
      }
    }
    known.current = new Set(data.map((r) => r.id))
    setRows(data); setLoaded(true)
  }, [pass, audio])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const totalUnseen = unseen.hotel + unseen.embarcacion + unseen.vehiculo
  useEffect(() => {
    document.title = (totalUnseen ? `(${totalUnseen}) ` : '') + 'Admin · Seawolf'
    return () => { document.title = 'Seawolf SAI' }
  }, [totalUnseen])

  const act = async (fn, args) => {
    const { error } = await sb.rpc(fn, { p_pass: pass, ...args })
    if (error) { setError(errMsg(error)); return false }
    await load(); return true
  }

  const open = (t) => { setTab(t); if (unseen[t]) setUnseen((u) => ({ ...u, [t]: 0 })) }
  const tabs = [['resumen', 'Analítica'], ['hotel', 'Habitaciones'], ['embarcacion', 'Embarcaciones'], ['vehiculo', 'Vehículos'], ['catalogo', 'Catálogo'], ['ajustes', 'Ajustes']]

  return (
    <div className="admin">
      <div className="admin-top">
        <div className="wrap">
          <a className="brand" href="#/inicio"><img src={img(IM.logo)} alt="" style={{ width: 38, height: 38 }} /><b style={{ color: '#fff', fontSize: '1.15rem' }}>SEAWOLF · Admin</b></a>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.78rem', color: '#9cc3bf' }}>Actualiza cada {POLL_MS / 1000} s</span>
            <button className="btn small light" onClick={load}>Actualizar</button>
            <button className="btn small coral" onClick={onLogout}>Salir</button>
          </div>
        </div>
        <div className="wrap admin-tabs">
          {tabs.map(([k, t]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => open(k)}>
              {t}{unseen[k] ? <span className="badge">{unseen[k]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="wrap" style={{ paddingBlock: 24, display: 'grid', gap: 18 }}>
        {error && <p className="err">{error}</p>}
        {!loaded ? <p className="muted">Cargando reservas…</p>
          : tab === 'resumen' ? <Analytics rows={rows} items={catalog.items} />
            : tab === 'catalogo' ? <CatalogEditor pass={pass} catalog={catalog} />
              : tab === 'ajustes' ? <Settings pass={pass} onLogout={onLogout} />
                : <ReservasTable tipo={tab} rows={rows.filter((r) => r.tipo === tab)} fresh={fresh} act={act} />}
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map(({ id, r }) => (
          <div key={id} className="toast" onClick={() => { open(r.tipo); setToasts((t) => t.filter((x) => x.id !== id)) }}>
            <b>Nueva reserva · {TIPOS[r.tipo]?.single}</b>
            <span>{r.nombre} · {r.item_nombre}</span>
            <span className="num" style={{ fontSize: '.85rem', color: '#9cc3bf' }}>{r.codigo} · {money(r.total)} · {r.ciudad || 'sin ciudad'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bars({ data, max, occ, fmt = (v) => v }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.v))
  if (!data.length) return <p className="muted" style={{ fontSize: '.85rem' }}>Sin datos todavía.</p>
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar" key={d.k}>
          <span className="t" title={d.k}>{d.k}</span>
          <div className="track"><div className={'fill' + (occ ? ' occ' : '')} style={{ width: `${Math.min(100, (d.v / (d.max ?? m)) * 100)}%` }} /></div>
          <span className="num" style={{ fontWeight: 600 }}>{fmt(d.v, d)}</span>
        </div>
      ))}
    </div>
  )
}

function Analytics({ rows, items }) {
  const today = isoLocal()
  const vivas = rows.filter((r) => r.estado !== 'cancelado')
  const count = (e) => rows.filter((r) => r.estado === e).length
  const confirmadas = count('activo') + count('usado')
  const ingresos = rows.filter((r) => r.estado === 'activo' || r.estado === 'usado').reduce((s, r) => s + Number(r.total), 0)
  const porCobrar = rows.filter((r) => r.estado === 'pendiente').reduce((s, r) => s + Number(r.total), 0)

  const ciudades = Object.entries(vivas.reduce((m, r) => { const c = r.ciudad || 'Sin ciudad'; m[c] = (m[c] || 0) + 1; return m }, {}))
    .map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8)
  const porTipo = Object.keys(TIPOS).map((t) => ({ k: TIPOS[t].label, v: vivas.filter((r) => r.tipo === t).length }))

  const dias = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const porDia = dias.map((d) => ({ d, v: rows.filter((r) => isoLocal(new Date(r.creado)) === d).length }))
  const maxDia = Math.max(1, ...porDia.map((x) => x.v))

  const covers = (r, d) => r.tipo === 'hotel' ? r.fecha_inicio <= d && r.fecha_fin > d : r.fecha_inicio <= d && r.fecha_fin >= d
  const vehiculos = items.filter((i) => i.tipo === 'vehiculo').map((i) => {
    const ocup = vivas.filter((r) => r.item_id === i.id && covers(r, today)).reduce((s, r) => s + r.cantidad, 0)
    return { k: i.nombre, v: ocup, max: i.unidades, libres: Math.max(i.unidades - ocup, 0) }
  })
  const vehOcup = vehiculos.reduce((s, v) => s + v.v, 0)
  const vehTot = vehiculos.reduce((s, v) => s + v.max, 0)

  const barcos = items.filter((i) => i.tipo === 'embarcacion').map((i) => {
    const rs = vivas.filter((r) => r.item_id === i.id)
    return {
      k: i.nombre, cap: i.capacidad,
      hoy: rs.filter((r) => r.fecha_inicio === today).reduce((s, r) => s + r.personas, 0),
      prox: rs.filter((r) => r.fecha_inicio >= today).reduce((s, r) => s + r.personas, 0),
      total: rs.reduce((s, r) => s + r.personas, 0)
    }
  })

  const hoteles = items.filter((i) => i.tipo === 'hotel').map((i) => ({
    k: i.nombre, max: i.unidades,
    v: vivas.filter((r) => r.item_id === i.id && covers(r, today)).reduce((s, r) => s + r.cantidad, 0)
  }))

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>Reservas totales</span><b>{rows.length}</b></div>
        <div className="kpi good"><span>Confirmadas</span><b>{confirmadas}</b></div>
        <div className="kpi good"><span>QR activos</span><b>{count('activo')}</b></div>
        <div className="kpi warn"><span>QR por activar</span><b>{count('pendiente')}</b></div>
        <div className="kpi"><span>QR usados</span><b>{count('usado')}</b></div>
        <div className="kpi hot"><span>Canceladas</span><b>{count('cancelado')}</b></div>
        <div className="kpi good"><span>Ingresos confirmados</span><b style={{ fontSize: '1.3rem' }}>{money(ingresos)}</b></div>
        <div className="kpi warn"><span>Por cobrar</span><b style={{ fontSize: '1.3rem' }}>{money(porCobrar)}</b></div>
        <div className="kpi"><span>Vehículos ocupados hoy</span><b>{vehOcup}<small style={{ fontSize: '.9rem', color: 'var(--muted)' }}> / {vehTot}</small></b></div>
        <div className="kpi good"><span>Vehículos disponibles</span><b>{Math.max(vehTot - vehOcup, 0)}</b></div>
      </div>

      <div className="panels">
        <div className="panel">
          <h3>Reservas creadas · últimos 14 días</h3>
          <div className="cols">
            {porDia.map((x) => <div key={x.d} title={`${fdate(x.d)}: ${x.v}`}><span className="num">{x.v || ''}</span><i style={{ height: `${(x.v / maxDia) * 100}%` }} /></div>)}
          </div>
          <div className="cols-x">{porDia.map((x, i) => <span key={x.d}>{i % 2 === 1 ? '' : x.d.slice(8)}</span>)}</div>
        </div>
        <div className="panel"><h3>Ciudad de origen de los visitantes</h3><Bars data={ciudades} /></div>
        <div className="panel"><h3>Reservas por categoría (sin canceladas)</h3><Bars data={porTipo} /></div>
        <div className="panel">
          <h3>Vehículos hoy · ocupados / flota</h3>
          <Bars data={vehiculos} occ fmt={(v, d) => `${v}/${d.max} · ${d.libres} libres`} />
        </div>
        <div className="panel">
          <h3>Clientes por embarcación</h3>
          {barcos.length === 0 ? <p className="muted">Sin embarcaciones en el catálogo.</p> : (
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead><tr><th>Embarcación</th><th>Hoy</th><th>Próximos</th><th>Total</th></tr></thead>
                <tbody>{barcos.map((b) => (
                  <tr key={b.k}><td>{b.k}</td><td className="num">{b.hoy} / {b.cap}</td><td className="num">{b.prox}</td><td className="num"><b>{b.total}</b></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel"><h3>Alojamientos ocupados esta noche</h3><Bars data={hoteles} occ fmt={(v, d) => `${v}/${d.max}`} /></div>
      </div>
    </>
  )
}

function QrMini({ code }) {
  const url = useQr(code, 240)
  return url ? <img src={url} alt={'QR ' + code} style={{ width: 160, height: 160 }} /> : null
}

function ReservasTable({ tipo, rows, fresh, act }) {
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [edit, setEdit] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [qr, setQr] = useState(null)
  const list = rows.filter((r) => (!estado || r.estado === estado) &&
    (!q || [r.codigo, r.nombre, r.email, r.telefono, r.ciudad, r.item_nombre].join(' ').toLowerCase().includes(q.toLowerCase())))
  const t = TIPOS[tipo]
  return (
    <>
      <div className="kpis">
        {ESTADOS.map((e) => (
          <button key={e} className={'kpi ' + (e === 'pendiente' ? 'warn' : e === 'cancelado' ? 'hot' : 'good')} style={{ textAlign: 'left', cursor: 'pointer', outline: estado === e ? '2px solid var(--reef)' : 'none' }} onClick={() => setEstado(estado === e ? '' : e)}>
            <span>{e}</span><b>{rows.filter((r) => r.estado === e).length}</b>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input id={'q-' + tipo} className="input" placeholder={`Buscar en ${t.label.toLowerCase()}: código, nombre, ciudad…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select id={'e-' + tipo} className="input" value={estado} onChange={(e) => setEstado(e.target.value)} style={{ flex: '0 0 auto' }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Código / QR</th><th>Cliente</th><th>Servicio</th><th>Fechas</th><th>Pers.</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="8" className="muted" style={{ padding: 24 }}>No hay reservas que coincidan. Las nuevas aparecerán aquí con una alerta.</td></tr>}
            {list.map((r) => (
              <tr key={r.id} className={fresh.has(r.id) ? 'new' : ''}>
                <td><button className="tab" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '.8rem', padding: '.3em .7em' }} onClick={() => setQr(r)}>{r.codigo}</button><div className="muted" style={{ fontSize: '.72rem', marginTop: 4 }}>{fdatetime(r.creado)}</div></td>
                <td><b>{r.nombre}</b><div className="muted" style={{ fontSize: '.78rem' }}>{r.telefono}<br />{r.email}<br />{r.ciudad}</div></td>
                <td>{r.item_nombre}{tipo === 'vehiculo' && <div className="muted">{r.cantidad} unidad(es)</div>}{r.notas && <div className="muted" style={{ fontSize: '.75rem' }}>“{r.notas}”</div>}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fdate(r.fecha_inicio)}{r.fecha_fin !== r.fecha_inicio && <><br />→ {fdate(r.fecha_fin)}</>}</td>
                <td className="num">{r.personas}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{money(r.total)}</td>
                <td><span className={'state ' + r.estado}>{r.estado}</span>{r.activado && <div className="muted" style={{ fontSize: '.7rem', marginTop: 4 }}>Activo: {fdatetime(r.activado)}</div>}</td>
                <td>
                  <div className="actions">
                    {r.estado === 'pendiente' && <button className="btn small ok" onClick={() => act('sw_admin_estado', { p_id: r.id, p_estado: 'activo' })}>Activar QR</button>}
                    {r.estado === 'activo' && <button className="btn small ghost" onClick={() => act('sw_admin_estado', { p_id: r.id, p_estado: 'pendiente' })}>Desactivar</button>}
                    {r.estado === 'activo' && <button className="btn small ghost" onClick={() => act('sw_admin_estado', { p_id: r.id, p_estado: 'usado' })}>Marcar usado</button>}
                    {r.estado !== 'cancelado' && <button className="btn small ghost" onClick={() => act('sw_admin_estado', { p_id: r.id, p_estado: 'cancelado' })}>Cancelar</button>}
                    {r.estado === 'cancelado' && <button className="btn small ghost" onClick={() => act('sw_admin_estado', { p_id: r.id, p_estado: 'pendiente' })}>Reabrir</button>}
                    <button className="btn small ghost" onClick={() => setEdit({ ...r })}>Editar</button>
                    {confirmDel === r.id
                      ? <><button className="btn small coral" onClick={async () => { await act('sw_admin_borrar_reserva', { p_id: r.id }); setConfirmDel(null) }}>Confirmar borrado</button><button className="btn small ghost" onClick={() => setConfirmDel(null)}>No</button></>
                      : <button className="btn small ghost" onClick={() => setConfirmDel(r.id)}>Borrar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qr && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setQr(null)}>
          <div className="panel" style={{ width: 'min(100%, 420px)' }}>
            <button className="close" onClick={() => setQr(null)} style={{ justifySelf: 'end', background: 'none', border: 0, fontSize: '1.5rem', cursor: 'pointer' }} aria-label="Cerrar">×</button>
            <Ticket r={qr} />
          </div>
        </div>
      )}

      {edit && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setEdit(null)}>
          <form className="panel" style={{ width: 'min(100%, 560px)' }} onSubmit={async (e) => {
            e.preventDefault()
            const { id, nombre, email, telefono, ciudad, personas, cantidad, fecha_inicio, fecha_fin, total, notas } = edit
            if (await act('sw_admin_editar_reserva', { p_id: id, p: { nombre, email, telefono, ciudad, personas, cantidad, fecha_inicio, fecha_fin, total, notas } })) setEdit(null)
          }}>
            <h3 style={{ fontSize: '1.1rem' }}>Editar reserva {edit.codigo}</h3>
            <div className="form2">
              {[['nombre', 'Nombre'], ['telefono', 'Teléfono'], ['email', 'Email'], ['ciudad', 'Ciudad'], ['fecha_inicio', 'Inicio', 'date'], ['fecha_fin', 'Fin', 'date'], ['personas', 'Personas', 'number'], ['cantidad', 'Unidades', 'number'], ['total', 'Total (COP)', 'number']].map(([k, l, type]) => (
                <div className="field" key={k}><label htmlFor={'ed-' + k}>{l}</label><input id={'ed-' + k} type={type || 'text'} className="input" value={edit[k] ?? ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
              ))}
              <div className="field full"><label htmlFor="ed-notas">Notas</label><textarea id="ed-notas" className="input" rows="2" value={edit.notas ?? ''} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></div>
            </div>
            <div className="actions"><button className="btn" type="submit">Guardar cambios</button><button className="btn ghost" type="button" onClick={() => setEdit(null)}>Cancelar</button></div>
          </form>
        </div>
      )}
    </>
  )
}

function CatalogEditor({ pass, catalog }) {
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const blank = { id: '', tipo: 'vehiculo', nombre: '', descripcion: '', precio: 0, capacidad: 1, unidades: 1, imagenes: [], activo: true, orden: 0 }
  const save = async (e) => {
    e.preventDefault()
    const id = draft.id || draft.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const imagenes = typeof draft.imagenes === 'string' ? draft.imagenes.split(',').map((s) => s.trim()).filter(Boolean) : draft.imagenes
    const { error } = await sb.rpc('sw_admin_guardar_item', { p_pass: pass, p: { ...draft, id, imagenes } })
    if (error) return setMsg(errMsg(error))
    setMsg('Guardado.'); setDraft(null); catalog.reload()
  }
  const del = async (id) => {
    const { error } = await sb.rpc('sw_admin_borrar_item', { p_pass: pass, p_id: id })
    setConfirmDel(null)
    if (error) return setMsg(errMsg(error))
    catalog.reload()
  }
  return (
    <>
      <div className="toolbar">
        <p className="muted" style={{ flex: 1 }}>Edita precios, capacidad, unidades de flota, fotos y visibilidad. Los cambios se ven al instante en el sitio.</p>
        <button className="btn" onClick={() => setDraft({ ...blank })}>Nuevo servicio</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Servicio</th><th>Tipo</th><th>Precio</th><th>Capacidad</th><th>Unidades</th><th>Visible</th><th></th></tr></thead>
          <tbody>{catalog.items.map((i) => (
            <tr key={i.id}>
              <td><b>{i.nombre}</b><div className="muted" style={{ fontSize: '.75rem' }}>{i.id}</div></td>
              <td>{TIPOS[i.tipo].single}</td>
              <td className="num">{money(i.precio)} / {TIPOS[i.tipo].unit}</td>
              <td className="num">{i.capacidad}</td>
              <td className="num">{i.tipo === 'embarcacion' ? '—' : i.unidades}</td>
              <td>{i.activo ? 'Sí' : 'No'}</td>
              <td><div className="actions">
                <button className="btn small ghost" onClick={() => setDraft({ ...i, imagenes: i.imagenes.join(', ') })}>Editar</button>
                {confirmDel === i.id
                  ? <><button className="btn small coral" onClick={() => del(i.id)}>Confirmar</button><button className="btn small ghost" onClick={() => setConfirmDel(null)}>No</button></>
                  : <button className="btn small ghost" onClick={() => setConfirmDel(i.id)}>Borrar</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {draft && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setDraft(null)}>
          <form className="panel" style={{ width: 'min(100%, 600px)' }} onSubmit={save}>
            <h3 style={{ fontSize: '1.1rem' }}>{draft.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            <div className="form2">
              <div className="field full"><label htmlFor="cat-n">Nombre</label><input id="cat-n" className="input" required value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} /></div>
              <div className="field"><label htmlFor="cat-t">Tipo</label>
                <select id="cat-t" className="input" value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}>
                  {Object.keys(TIPOS).map((t) => <option key={t} value={t}>{TIPOS[t].single}</option>)}
                </select></div>
              <div className="field"><label htmlFor="cat-p">Precio por {TIPOS[draft.tipo].unit} (COP)</label><input id="cat-p" type="number" min="0" className="input" value={draft.precio} onChange={(e) => setDraft({ ...draft, precio: e.target.value })} /></div>
              <div className="field"><label htmlFor="cat-c">Capacidad ({TIPOS[draft.tipo].cap})</label><input id="cat-c" type="number" min="1" className="input" value={draft.capacidad} onChange={(e) => setDraft({ ...draft, capacidad: e.target.value })} /></div>
              <div className="field"><label htmlFor="cat-u">Unidades disponibles</label><input id="cat-u" type="number" min="1" className="input" value={draft.unidades} onChange={(e) => setDraft({ ...draft, unidades: e.target.value })} disabled={draft.tipo === 'embarcacion'} /></div>
              <div className="field full"><label htmlFor="cat-d">Descripción</label><textarea id="cat-d" rows="3" className="input" value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} /></div>
              <div className="field full"><label htmlFor="cat-i">Imágenes (rutas o URLs separadas por coma)</label><input id="cat-i" className="input" value={draft.imagenes} onChange={(e) => setDraft({ ...draft, imagenes: e.target.value })} placeholder="img/i6.webp, https://…" /></div>
              <div className="field"><label htmlFor="cat-o">Orden</label><input id="cat-o" type="number" className="input" value={draft.orden} onChange={(e) => setDraft({ ...draft, orden: e.target.value })} /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'end' }}><input type="checkbox" checked={draft.activo} onChange={(e) => setDraft({ ...draft, activo: e.target.checked })} /> Visible en el sitio</label>
            </div>
            <div className="actions"><button className="btn" type="submit">Guardar</button><button type="button" className="btn ghost" onClick={() => setDraft(null)}>Cancelar</button></div>
          </form>
        </div>
      )}
    </>
  )
}

function Settings({ pass, onLogout }) {
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <div className="panels">
      <form className="panel" onSubmit={async (e) => {
        e.preventDefault()
        if (n1 !== n2) return setMsg('Las contraseñas no coinciden.')
        const { error } = await sb.rpc('sw_admin_cambiar_pass', { p_pass: pass, p_nueva: n1 })
        if (error) return setMsg(errMsg(error))
        setMsg('Contraseña cambiada. Vuelve a entrar con la nueva.')
        setTimeout(onLogout, 1500)
      }}>
        <h3>Cambiar contraseña del panel</h3>
        <div className="field"><label htmlFor="set-1">Nueva contraseña</label><input id="set-1" type="password" className="input" value={n1} onChange={(e) => setN1(e.target.value)} minLength={4} required /></div>
        <div className="field"><label htmlFor="set-2">Repítela</label><input id="set-2" type="password" className="input" value={n2} onChange={(e) => setN2(e.target.value)} required /></div>
        {msg && <p className="muted">{msg}</p>}
        <button className="btn">Guardar contraseña</button>
      </form>
      <div className="panel">
        <h3>Accesos</h3>
        <p className="muted" style={{ fontSize: '.9rem' }}>Panel admin: <code>#/admin</code> (no aparece en el menú).<br />Validador para trabajadores: <code>#/staff</code>.<br />Consulta de clientes: <code>#/mi-reserva</code>.</p>
        <p className="muted" style={{ fontSize: '.9rem' }}>Las alertas suenan y aparecen en pantalla cuando entra una reserva nueva. Si el navegador lo permite, también llega una notificación del sistema con la pestaña en segundo plano.</p>
      </div>
    </div>
  )
}

/* =====================================================================
   App
   ===================================================================== */
export default function App() {
  const route = useRoute()
  const catalog = useCatalog()
  const [booking, setBooking] = useState(null)
  const page = route.split('/')[0]

  if (page === 'admin') return <Admin />

  const pages = {
    inicio: <Home onBook={setBooking} catalog={catalog} />,
    nosotros: <About />,
    experiencias: <Experiencias catalog={catalog} onBook={setBooking} />,
    alojamientos: <Alojamientos catalog={catalog} onBook={setBooking} />,
    'mi-reserva': <MiReserva />,
    staff: <Staff />
  }
  return (
    <>
      <Header route={page} />
      <main>{pages[page] || pages.inicio}</main>
      {page !== 'staff' && <Newsletter />}
      <Footer />
      {booking && <BookingModal item={booking} onClose={() => setBooking(null)} />}
    </>
  )
}
