// Configuración por defecto de LA VENGANZA 2.0.
// Todo lo marcado con `provisional: true` es contenido de relleno que Hugo debe sustituir desde el panel.
// No contiene recuerdos reales ni ubicaciones definitivas: solo estructura, humor y el contenido original del HTML.
import { toDMS } from './util.js';

const H = (title, text) => ({ title, text });

// Mensajes de fallo del HTML original (se conservan literalmente)
const M_SERIO = H('¡VA AHORA EN SERIO!', 'Esa no era la opción correcta y lo sabes perfectamente... 😜');
const M_COÑA = H('NI DE COÑA', '¿De verdad crees que esa es la respuesta correcta? Vuelve a pensarlo... 😂');
const M_GANA = H('HUGO SIEMPRE GANA', 'Esa no es la respuesta correcta... ¡Inténtalo de nuevo! 😏');

const opt = (id, text, correct = false, msg = null) => ({ id, text, correct, ...(msg ? { msg } : {}) });
const round = (id, prompt, options, extra = {}) => ({ id, kind: 'choice', prompt, subtitle: '', options, accepted: [], placeholder: '', allWrongFirst: 0, sound: '', image: '', explain: '', ...extra });
const textRound = (id, prompt, accepted, extra = {}) => ({ id, kind: 'text', prompt, subtitle: '', options: [], accepted, placeholder: 'Escribe tu respuesta…', allWrongFirst: 0, sound: '', image: '', explain: '', ...extra });
const task = (id, type, title, extra = {}) => ({ id, type, enabled: true, title, kicker: '', intro: '', callout: '', hints: [], reward: { fragment: 0, item: null, achievement: '', text: '' }, ...extra });

const loc1 = { lat: 40.199559, lng: -3.698496 }; // coordenadas del enlace de Maps del HTML original
const loc2 = { lat: 40.416775, lng: -3.70379 };
const loc3 = { lat: 40.415346, lng: -3.684419 };
const loc4 = { lat: 40.424, lng: -3.7177 };
const frag = (l) => { const d = toDMS(l.lat, l.lng); return { fragA: d.lat, fragB: d.lng }; };

export function defaultConfig() {
  return {
    schema: 1,
    epoch: 1,
    meta: { title: 'LA VENGANZA 2.0', subtitle: 'Una aventura exclusiva para Nixi.', playerName: 'Nixi', hostName: 'Hugo' },
    intro: {
      lines: ['Nixi.', 'Hugo ha estado ocupado.', 'Muy ocupado.'],
      paragraphs: [
        '¿Pensabas que te iba a dar tus regalos así de fácil?',
        'He preparado unas cuantas sorpresas para ti, pero tendrás que ganártelas. Habrá preguntas, acertijos, recuerdos y, obviamente, alguna que otra putada.',
        'Tranquila, lo hago desde el amor.',
      ],
      button: 'Empezar mi sufrimiento',
      small: 'Al continuar aceptas que Hugo siempre tiene razón',
    },
    settings: {
      difficulty: 'normal', // easy | normal | hard: ajusta cuándo aparece la ayuda
      hintAfterFails: 2,
      hintDelaySec: 45,
      wrongOverlayEvery: 3, // pantalla grande de fallo: la 1ª vez y cada N fallos; el resto, aviso breve
      geolocation: true,
      schedule: { enabled: true, timezone: 'Europe/Madrid', startAt: '2026-11-27T18:30', dailyTime: '17:30', finalAt: '2026-12-05T17:30' }, // el juego no se abre antes de startAt; cada regalo siguiente, al día siguiente a dailyTime; el secreto (capítulo oculto), no antes de finalAt
      bouncerMedia: ['bounce-hugo', 'bounce-nixi', 'photo-us'],
      minigames: { memory: true, jigsaw: true, runner: true, runaway: true, sequence: true, hidden: true, scratch: true, pixel: true, order: true, safe: true },
      hideFinalChapterUntilFakeEnding: true,
      ringReferenceEnabled: false, // el anillo/propuesta SOLO aparece si lo activas aquí
    },
    trolls: {
      wrong: [
        M_SERIO, M_COÑA, M_GANA,
        H('ERROR 404', 'Neuronas no encontradas. Reinicia el cerebro e inténtalo otra vez.'),
        H('CASI', 'Y por «casi» quiero decir «ni de lejos». Pero con cariño.'),
        H('PUNTO PARA HUGO', 'Vas 0 – 1. Por si te sirve de consuelo, el 1 es mío.'),
        H('LO HE OÍDO TODO', 'Hasta mi paciencia ha puesto los ojos en blanco.'),
        H('ESO NO ERA', 'Tranquila: tengo todo el día. Y toda la noche. Y todas las pistas.'),
        H('MMM… NO', 'Respira hondo, cuenta hasta tres y piensa como Hugo (difícil, lo sé).'),
        H('FALLO ESTRATÉGICO', 'Hugo asiente despacio, con una sonrisa que da bastante miedo.'),
      ],
      helper: H('VALE, TE ECHO UN CABLE', 'Pulsa «Necesito ayuda» (sin penalización, de verdad) y Hugo se apiada de ti.'),
      cheer: ['¡Eso es!', 'Bien jugado, Nixi.', 'Hugo lo ha visto venir… o no.', 'Punto para ti. Disfrútalo, es el único.', 'Vaya, sí que tienes cerebro.'],
      hintGeneric: ['Respira y léelo otra vez, despacio.', 'Piensa como lo haría Hugo (con cuidado, que es peligroso).', 'Fíjate en lo que tienes delante: casi siempre está ahí.'],
    },
    achievements: [
      { id: 'primera_derrota', title: 'Primer fracaso', desc: 'Fallar por primera vez. Qué ilusión.', icon: 'x' },
      { id: 'superviviente', title: 'Superviviente de Hugo', desc: 'Terminar el capítulo 1.', icon: 'flame' },
      { id: 'experta', title: 'Experta en aguantarme', desc: 'Acumular 12 fallos y seguir adelante.', icon: 'heart' },
      { id: 'cartografa', title: 'Cartógrafa', desc: 'Montar unas coordenadas a la primera.', icon: 'compass' },
      { id: 'sin_ayuda', title: 'Cerebrito', desc: 'Superar un capítulo sin pedir ninguna ayuda.', icon: 'lightbulb' },
      { id: 'piloto', title: 'Piloto de carreras', desc: 'Recoger todos los corazones sin chocar.', icon: 'car' },
      { id: 'paciencia', title: 'Paciencia infinita', desc: 'Atrapar al botón escurridizo.', icon: 'sparkles' },
      { id: 'oido', title: 'Oído salvaje', desc: 'Acertar todos los sonidos a la primera.', icon: 'music' },
      { id: 'trampa', title: 'Caíste en la trampa', desc: 'Creer que habíamos terminado.', icon: 'ticket' },
      { id: 'novia_del_ano', title: 'Novia del año', desc: 'Completar toda la venganza.', icon: 'crown' },
    ],
    media: [
      { id: 'bounce-hugo', file: 'bounce-hugo.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Foto rebotante: Hugo (provisional)' },
      { id: 'bounce-nixi', file: 'bounce-nixi.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Foto rebotante: Nixi (provisional)' },
      { id: 'photo-us', file: 'placeholder-us.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Foto de los dos (provisional)' },
      { id: 'mystery', file: 'placeholder-mystery.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Foto misteriosa (provisional)' },
      { id: 'gallery-1', file: 'placeholder-photo-1.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Galería final 1 (provisional)' },
      { id: 'gallery-2', file: 'placeholder-photo-2.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Galería final 2 (provisional)' },
      { id: 'gallery-3', file: 'placeholder-photo-3.svg', kind: 'image', visibility: 'public', builtin: true, label: 'Galería final 3 (provisional)' },
    ],
    fakeEnding: {
      title: '¡GINCANA COMPLETADA!',
      farewell: 'Gracias por jugar, Nixi. Ha sido un auténtico placer verte sufrir. Hugo vuelve a ganar (como siempre).',
      credits: [
        { role: 'Dirección', name: 'Hugo' },
        { role: 'Guion', name: 'Hugo (con muchísimo esfuerzo)' },
        { role: 'Protagonista', name: 'Nixi (a regañadientes)' },
        { role: 'Banda sonora', name: 'Animales que no pidieron participar' },
        { role: 'Coche de apoyo', name: 'El de siempre' },
        { role: 'Víctima principal', name: 'Tu paciencia' },
        { role: 'Con la colaboración especial de', name: '«Hugo siempre tiene razón»' },
        { role: 'Ninguna novia resultó herida', name: '(Solo su orgullo)' },
      ],
      end: 'FIN',
      interrupt: { line1: '¿Ya te ibas?', line2: '¿De verdad pensabas que habíamos terminado?', button: 'Ay, no…' },
    },
    chapters: [
      // ───────────────────────────── CAPÍTULO 1 ─────────────────────────────
      {
        id: 'c1', n: 1, theme: 'c1', hidden: false, music: '',
        kicker: 'Capítulo 1', title: 'El calentamiento', subtitle: 'Nada que un cerebro mínimamente funcional no pueda resolver.',
        story: ['Primera parada. Esto solo es el calentamiento, Nixi.', 'Ya que haces webs, he decidido crear una para tus regalos. Mantén los ojos bien abiertos: en cada prueba conseguirás fragmentos de información y al final tendrás que unirlos todos.'],
        keyDigit: '7',
        codePrompt: 'Busca el sobre o la nota junto al regalo: tiene escrito un código secreto.',
        physicalCode: 'HUGO01',
        gift: { label: 'Regalo 1', title: 'El calentamiento', description: 'Un detallito para empezar con buen pie.', revealTitle: '¡Primer regalo desbloqueado!', revealText: '[EDITAR] Aquí va lo que haya escondido: un Burn, chuches, chocolates… o lo que decidas.', celebration: 'confetti', photos: [], audio: '', video: '', letter: null, fakeEnding: false, provisional: true },
        location: { name: 'Punto de encuentro 1', lat: loc1.lat, lng: loc1.lng, address: '', ...frag(loc1), note: 'Aquí está tu primer regalo. Busca el código secreto.', provisional: true, provisionalNote: 'Coordenadas heredadas del HTML original. Cámbialas por las reales.' },
        tasks: [
          task('c1t1', 'memory', 'Calentamiento', {
            kicker: 'Minijuego', prompt: 'Calentamos: encuentra las parejas. Spoiler: la mejor pareja de todas es Hugo + tú.',
            pairs: [{ id: 'p1', icon: 'heart' }, { id: 'p2', icon: 'star' }, { id: 'p3', icon: 'key' }, { id: 'p4', icon: 'car' }],
            revealText: 'Calentamiento superado. Y sí, Hugo siempre es la mejor opción.',
            hints: ['Las cartas se repiten, no se inventan.', 'Te dejo ver las cartas un segundo al empezar.', 'Última ayuda: se resaltan dos cartas pareja.'],
          }),
          task('c1t2', 'troll', 'Falsa victoria', {
            kind: 'fakeVictory', heading: '¡ENHORABUENA, NIXI!',
            text: 'Has completado LA VENGANZA 2.0. Tu premio: un fuerte aplauso y absolutamente nada más.',
            twist: '…JA. Qué ingenua. Esto no ha hecho más que empezar.', button: 'Vale, sigamos', photo: true,
          }),
          task('c1t3', 'scratch', 'Acertijo lógico', {
            kicker: 'Acertijo lógico',
            callout: '¡Atención: modo reto activado! A partir de aquí se revelan pistas reales. Apunta o guarda lo que aparezca en pantalla (tranquila, la app las guarda en tu mochila).',
            prompt: 'Resuelve el acertijo rascando la pantalla:\n«Mujer al volante + Alta velocidad = ?»',
            revealText: 'Mujer al volante + Alta velocidad = Peligro constante.',
            hints: ['Pasa el dedo por todo el cuadro.', 'Hugo opina que es «constante».', 'La respuesta empieza por «Peligro».'],
            reward: { fragment: 1, item: null, achievement: '', text: '' },
          }),
          task('c1t4', 'runner', 'A ver cómo conduces', {
            kicker: 'Minijuego', prompt: 'Demuestra tu pericia al volante: recoge 8 corazones y esquiva los conos. Toca a izquierda o derecha (o desliza) para cambiar de carril.',
            target: 8, revealText: 'Veredicto de Hugo: conduces… dignamente. Aprobada por los pelos.',
            hints: ['Los conos no te hacen daño, solo te hacen quedar mal.', 'Con poco ánimo: el coche irá más despacio.', 'Última ayuda: carriles más anchos y menos conos.'],
          }),
          task('c1t5', 'runaway', 'El botón escurridizo', {
            kicker: 'Minijuego', prompt: 'Pulsa el botón para reclamar tu pista. Sin trampas.', buttonText: 'Reclamar pista', dodges: 6,
            taunts: ['Casi…', 'Demasiado lenta', '¿Eso era un intento?', 'Uy, qué cerca', 'Hugo me ha dicho que no me dejara', 'Vale, me cansé'],
            revealText: 'Mira por dónde, tenías paciencia.',
            hints: ['Se cansa si insistes.', 'Cada intento le cuesta energía.', 'Un par de intentos más y se rinde.'],
          }),
          task('c1t6', 'hidden', 'Recompensa', {
            kicker: 'Minijuego', scene: 'night',
            prompt: 'Hugo ha escondido tu recompensa en tres trozos por el cielo. Encuéntralos tocando la pantalla.',
            hotspots: [{ id: 'r1', x: 18, y: 34, label: 'Recompensa' }, { id: 'r2', x: 74, y: 26, label: 'Recompensa' }, { id: 'r3', x: 52, y: 66, label: 'Recompensa' }],
            revealText: 'Tu recompensa: la venganza de Hugo. Era la única opción buena.',
            hints: ['Brillan un poquito más que las demás.', 'Hay una arriba a la derecha.', 'Última ayuda: una de ellas parpadea.'],
            reward: { fragment: 2, item: null, achievement: '', text: 'Reflexión: ahora solo queda que pienses qué podría ser lo mostrado al final de cada pantalla…' },
          }),
        ],
      },
      // ───────────────────────────── CAPÍTULO 2 ─────────────────────────────
      {
        id: 'c2', n: 2, theme: 'c2', hidden: false, music: '',
        kicker: 'Capítulo 2', title: 'Demuestra que me conoces', subtitle: 'Aquí no vale improvisar.',
        story: ['Segundo regalo. Y bastante mejor que el primero.', 'Para conseguirlo tendrás que demostrar que sabes quién soy… y quiénes somos cuando estamos juntos.'],
        keyDigit: '3',
        codePrompt: 'Cuando llegues, busca el código secreto junto al regalo.',
        physicalCode: 'HUGO02',
        gift: { label: 'Regalo 2', title: '[EDITAR] Regalo 2', description: 'Un regalo de los que valen la pena.', revealTitle: '¡Segundo regalo desbloqueado!', revealText: '[EDITAR] Describe aquí el regalo 2 y lo que significa.', celebration: 'confetti', photos: [], audio: '', video: '', letter: null, fakeEnding: false, provisional: true },
        location: { name: 'Ubicación 2 (provisional)', lat: loc2.lat, lng: loc2.lng, address: '', ...frag(loc2), note: 'Aquí te espera el segundo regalo.', provisional: true, provisionalNote: 'Puerta del Sol (Madrid) como relleno. Cámbiala por la real.' },
        tasks: [
          task('c2t1', 'quiz', 'Preguntas sobre nosotros', {
            kicker: 'Demuestra que me conoces', provisional: true,
            hints: ['Piensa con el corazón, no con la cabeza.', 'Hugo no pregunta cosas imposibles.', 'La respuesta está en un recuerdo vuestro.'],
            rounds: [
              round('r1', '[EDITAR] ¿Dónde fue nuestra primera cita?', [opt('a', 'Lugar A (edítame)', true), opt('b', 'Lugar B (edítame)'), opt('c', 'Lugar C (edítame)')]),
              round('r2', '[EDITAR] ¿Qué día empezó todo?', [opt('a', 'Fecha A (edítame)'), opt('b', 'Fecha B (edítame)', true), opt('c', 'Fecha C (edítame)')]),
              round('r3', '[EDITAR] ¿Cuál es mi comida favorita?', [opt('a', 'Opción A (edítame)'), opt('b', 'Opción B (edítame)'), opt('c', 'Opción C (edítame)', true)]),
              textRound('r4', '[EDITAR] ¿Cómo te llamo cuando estás de mal humor?', ['edita esta respuesta']),
            ],
          }),
          task('c2t2', 'order', 'Ordena los recuerdos', {
            kicker: 'Línea del tiempo', provisional: true, prompt: '[EDITAR] Ordena nuestros recuerdos del más antiguo al más reciente.',
            items: [{ id: 'i1', text: 'Recuerdo 1 (edítame)' }, { id: 'i2', text: 'Recuerdo 2 (edítame)' }, { id: 'i3', text: 'Recuerdo 3 (edítame)' }, { id: 'i4', text: 'Recuerdo 4 (edítame)' }],
            hints: ['Empieza por el que sabes seguro que fue el primero.', 'Mueve de uno en uno con las flechas.', 'Fíjate en los números: están en orden.'],
          }),
          task('c2t3', 'pixel', 'La foto misteriosa', {
            kicker: 'Fotografía misteriosa', provisional: true, prompt: '[EDITAR] Esta foto está muy pixelada. Pulsa «Aclarar» hasta que sepas qué es y escríbelo.', image: 'mystery', accepted: ['corazon', 'un corazon'], placeholder: '¿Qué es?',
            reward: { fragment: 1, item: null, achievement: '', text: '' },
            hints: ['Aclara la imagen: pulsa el botón varias veces.', 'Es algo que sientes por alguien.', 'Empieza por «cora».'],
          }),
          task('c2t4', 'safe', 'La caja fuerte', {
            kicker: 'Caja fuerte', provisional: true, prompt: '[EDITAR] La caja fuerte de Hugo se abre con una fecha importante (DDMM).', digits: 4, code: '0702', codeSource: 'fixed',
            hints: ['Es una fecha que Hugo no olvida.', 'Cuatro cifras: día y mes.', '[EDITAR] La última pista debe dar la respuesta.'],
          }),
          task('c2t5', 'memory', 'Memoria de elefante', {
            kicker: 'Minijuego', prompt: 'Encuentra todas las parejas. Hugo asegura que tú recuerdas todo lo que te conviene.',
            pairs: [{ id: 'p1', icon: 'heart' }, { id: 'p2', icon: 'star' }, { id: 'p3', icon: 'key' }, { id: 'p4', icon: 'car' }, { id: 'p5', icon: 'moon' }, { id: 'p6', icon: 'coffee' }],
            revealText: 'Memoria de elefante confirmada.',
            hints: ['Las cartas se repiten, no se inventan.', 'Te dejo ver las cartas un segundo al empezar.', 'Última ayuda: se resaltan dos cartas pareja.'],
          }),
          task('c2t6', 'jigsaw', 'Puzzle de recuerdos', {
            kicker: 'Puzzle', provisional: true, prompt: '[EDITAR] Recompón la foto: toca dos piezas para intercambiarlas. (Sube vuestra foto desde el panel.)', image: 'photo-us', grid: 3,
            revealText: 'Foto recompuesta. Qué guapos salimos.',
            reward: { fragment: 2, item: null, achievement: '', text: '' },
            hints: ['Empieza por las esquinas.', 'Toca «Ver modelo» para mirar la foto completa.', 'Última ayuda: Hugo coloca dos piezas por ti.'],
          }),
        ],
      },
      // ───────────────────────────── CAPÍTULO 3 ─────────────────────────────
      {
        id: 'c3', n: 3, theme: 'c3', hidden: false, music: '',
        kicker: 'Capítulo 3', title: 'Instinto', subtitle: 'Despierta tu lado más salvaje.',
        story: ['Tercer regalo. Aquí ya no vale ser racional.', 'Escucha, observa y fíate de tus instintos. Hugo ha hecho los deberes.'],
        keyDigit: '9',
        codePrompt: 'Busca un sobre en el lugar indicado. El código secreto estará con él.',
        physicalCode: 'HUGO03',
        gift: { label: 'Regalo 3', title: 'Una aventura salvaje', description: 'Una experiencia para vivir juntos.', revealTitle: '¡Aventura salvaje desbloqueada!', revealText: 'Dentro del sobre: un vale para vivir una aventura salvaje juntos. [EDITAR: añade aquí la fecha del safari y los detalles]', celebration: 'safari', photos: [], audio: '', video: '', letter: null, fakeEnding: true, provisional: true },
        location: { name: 'Ubicación 3 (provisional)', lat: loc3.lat, lng: loc3.lng, address: '', ...frag(loc3), note: 'Busca el sobre con el vale o las entradas.', provisional: true, provisionalNote: 'Parque de El Retiro (Madrid) como relleno. Cámbiala por la real.' },
        tasks: [
          task('c3t1', 'sequence', 'Oído fino', {
            kicker: 'Audios misteriosos', prompt: 'Sube el volumen y repite la secuencia de animales que oigas. Si fallas, Hugo la repite (sin castigo).', length: 3,
            pads: [{ id: 'leon', label: 'León', sound: 'synth:leon' }, { id: 'elefante', label: 'Elefante', sound: 'synth:elefante' }, { id: 'mono', label: 'Mono', sound: 'synth:mono' }, { id: 'lobo', label: 'Lobo', sound: 'synth:lobo' }],
            revealText: 'Oído fino confirmado.',
            hints: ['Sube el volumen del móvil.', 'Son animales, Nixi. Animales.', 'Última ayuda: se iluminan las notas mientras suenan.'],
          }),
          task('c3t2', 'jigsaw', 'Puzzle de la sabana', {
            kicker: 'Puzzle', provisional: true, prompt: '[EDITAR] Recompón la foto: toca dos piezas para intercambiarlas. (Sube una foto de la sabana o vuestra desde el panel.)', image: 'gallery-1', grid: 3,
            revealText: 'Puzle resuelto. Pensabas que sería más difícil, ¿eh?',
            reward: { fragment: 1, item: null, achievement: '', text: '' },
            hints: ['Empieza por las esquinas.', 'Toca «Ver modelo» para mirar la foto completa.', 'Última ayuda: Hugo coloca dos piezas por ti.'],
          }),
          task('c3t3', 'sequence', 'Eco animal', {
            kicker: 'Prueba de memoria', prompt: 'Repite la secuencia de sonidos. Si te equivocas, Hugo la vuelve a repetir (sin castigo).', length: 5,
            pads: [{ id: 'leon', label: 'León', sound: 'synth:leon' }, { id: 'elefante', label: 'Elefante', sound: 'synth:elefante' }, { id: 'mono', label: 'Mono', sound: 'synth:mono' }, { id: 'lobo', label: 'Lobo', sound: 'synth:lobo' }],
            revealText: 'Memoria auditiva: aprobada.',
            hints: ['Cierra los ojos y escucha.', 'La secuencia se acorta un poco.', 'Última ayuda: se iluminan las notas mientras suenan.'],
          }),
          task('c3t4', 'scratch', 'Huellas en el barro', {
            kicker: 'Mensaje oculto', prompt: 'El viento está borrando las huellas. Rasca la pantalla para descubrir el mensaje.',
            revealText: '«Hay lugares donde mandan los que tienen garras. Y tú vas a querer verlos de cerca.»',
            hints: ['Pasa el dedo por todo el cuadro.', 'No hace falta rascarlo entero.', 'Cada ayuda hace que se rasque más fácil.'],
          }),
          task('c3t5', 'hidden', 'Ojos en la maleza', {
            kicker: 'Mensajes ocultos', prompt: 'Cinco pares de ojos te observan desde la sabana. Encuéntralos todos tocando la pantalla.', scene: 'savanna',
            hotspots: [{ id: 'h1', x: 14, y: 62, label: 'Ojos' }, { id: 'h2', x: 38, y: 78, label: 'Ojos' }, { id: 'h3', x: 63, y: 55, label: 'Ojos' }, { id: 'h4', x: 82, y: 72, label: 'Ojos' }, { id: 'h5', x: 50, y: 30, label: 'Ojos' }],
            revealText: 'Cinco pares de ojos, cero sustos. Impresionante.',
            reward: { fragment: 2, item: null, achievement: '', text: '' },
            hints: ['Fíjate en los puntos brillantes.', 'Están a distintas alturas.', 'Última ayuda: uno de los pares destella.'],
          }),
        ],
      },
      // ───────────────────────────── CAPÍTULO 4 ─────────────────────────────
      {
        id: 'c4', n: 4, theme: 'c4', hidden: true, music: '',
        kicker: 'Capítulo 4', title: 'La última venganza', subtitle: 'Esta vez, de verdad.',
        story: ['Tenías razón en desconfiar.', 'Esto no ha terminado. Falta lo más importante.', 'Aquí no habrá bromas… bueno, casi ninguna.'],
        keyDigit: '',
        codePrompt: 'Hugo te estará esperando. Cuando lo encuentres, te dirá la palabra final.',
        physicalCode: 'HUGO04',
        gift: {
          label: 'Regalo 4', title: 'La última venganza', description: 'El más importante.', revealTitle: 'Y ahora sí…',
          revealText: '[EDITAR] Texto del momento final.', celebration: 'romance', photos: ['gallery-1', 'gallery-2', 'gallery-3'], audio: '', video: '',
          ringText: '', // solo se muestra si settings.ringReferenceEnabled = true
          letter: { title: 'Para Nixi', paragraphs: ['[EDITAR] Querida Nixi:', '[EDITAR] Aquí va tu carta de amor. Escribe lo que de verdad quieras decirle: lo que ha significado, lo que viene, lo que no se dice en voz alta.', '[EDITAR] Gracias por aguantarme, de verdad.'], signature: 'Hugo' },
          fakeEnding: false, provisional: true,
        },
        location: { name: 'Ubicación final (provisional)', lat: loc4.lat, lng: loc4.lng, address: '', ...frag(loc4), note: 'Hugo te espera aquí.', provisional: true, provisionalNote: 'Templo de Debod (Madrid) como relleno. Cámbiala por la real.' },
        tasks: [
          task('c4t1', 'order', 'Recuerdos', {
            kicker: 'Línea del tiempo', provisional: true, prompt: '[EDITAR] Ordena nuestros recuerdos más importantes, del primero al último.',
            items: [{ id: 'i1', text: 'Recuerdo 1 (edítame)' }, { id: 'i2', text: 'Recuerdo 2 (edítame)' }, { id: 'i3', text: 'Recuerdo 3 (edítame)' }, { id: 'i4', text: 'Recuerdo 4 (edítame)' }],
            hints: ['Esta vez no hay trampa.', 'Piensa en lo que sentiste.', '[EDITAR] La última pista debe dar la respuesta.'],
          }),
          task('c4t2', 'media', 'Un mensaje de Hugo', {
            kicker: 'Antes de seguir', prompt: 'Hugo tiene algo que decirte. Dale al play.', media: '', requirePlay: false, provisional: true,
          }),
          task('c4t3', 'quiz', 'Una última broma', {
            kicker: 'Callback', hints: ['Lo dice el principio de todo.', 'Está en la letra pequeña de la primera pantalla.', 'Hugo siempre…'],
            rounds: [textRound('r1', 'Completa la frase del principio: «Hugo siempre…»', ['tiene razon', '*tiene razon'], { subtitle: 'Sí, tienes que escribirlo.', placeholder: 'Hugo siempre…' })],
          }),
          task('c4t4', 'hidden', 'Estrellas en el cielo', {
            kicker: 'Mensajes ocultos', prompt: 'Faltan tres estrellas en el cielo. Búscalas tocando la pantalla con calma.', scene: 'night',
            hotspots: [{ id: 's1', x: 22, y: 28, label: 'Estrella' }, { id: 's2', x: 70, y: 20, label: 'Estrella' }, { id: 's3', x: 48, y: 62, label: 'Estrella' }],
            revealText: 'Tres estrellas encontradas.',
            reward: { fragment: 1, item: null, achievement: '', text: '' },
            hints: ['Brillan un poquito más que las demás.', 'Hay una arriba a la derecha.', 'Última ayuda: una de ellas parpadea.'],
          }),
          task('c4t5', 'safe', 'La última caja fuerte', {
            kicker: 'Última prueba', prompt: 'Abre la caja fuerte con las tres llaves que has ido guardando en tu mochila (una por cada regalo anterior).', digits: 3, code: '', codeSource: 'keyDigits',
            reward: { fragment: 2, item: null, achievement: '', text: '' },
            hints: ['Abre la mochila (arriba a la derecha).', 'Cada regalo te dio una cifra. El orden es el de los regalos.', 'La clave son las tres cifras de tus llaves, juntas y en orden.'],
          }),
        ],
      },
    ],
  };
}
