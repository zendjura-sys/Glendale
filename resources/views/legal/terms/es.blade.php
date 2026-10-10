{{-- Términos del servicio — traducción al español. Versión prevalente: en.blade.php --}}
<p>Estos Términos del servicio (los “Términos”) regulan el acceso a {{ $legal['name'] }} en <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a>, sus aplicaciones móviles, bots y servicios relacionados (en conjunto, el “Servicio”). El Servicio lo gestiona <strong>{{ $legal['operator'] }}</strong> ({{ $legal['country'] }}@if($legal['address']), {{ $legal['address'] }}@endif) (“nosotros”). Al crear una cuenta o usar el Servicio aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.</p>

<h2>1. El Servicio</h2>
<p>{{ $legal['name'] }} es una red social para jugadores y amantes del cine que incluye, entre otros: perfiles, publicaciones, comentarios y reacciones; mensajes privados y grupales; comunidades, familias y clanes; salas de voz y llamadas; un catálogo de juegos y servidores multijugador (incluido el rol de GTA) con votos, reseñas y herramientas para propietarios; “Buscar party”; personajes de rol; momentos (clips de YouTube, Twitch o Medal); indicadores de directo; misiones diarias y temporadas; un catálogo de cine con reproductores de terceros integrados y salas de “ver juntos”; música; bots de Telegram y Discord; “Iniciar sesión con {{ $legal['name'] }}” para servidores de juego; y las funciones de pago opcionales de la sección 7.</p>
<p>El Servicio se ofrece “tal cual” y evoluciona constantemente. <strong>Podemos añadir, cambiar, suspender o eliminar en cualquier momento, a nuestra entera discreción y sin aviso ni anuncio previo, cualquier función, módulo, límite, diseño o contenido del Servicio, incluidas las funciones de los planes de pago</strong>, en la medida permitida por la ley aplicable. Si un cambio reduce de forma sustancial un plan ya pagado, se mantienen tus derechos imperativos como consumidor (incluido un reembolso proporcional cuando la ley lo exija).</p>

<h2>2. Edad y cuentas</h2>
<ul>
    <li>Debes tener al menos 13 años (o la edad mayor de consentimiento digital de tu país, p. ej. 14 en España). Si eres menor de 18, confirmas que tu madre, padre o tutor ha aceptado estos Términos, incluidas las compras.</li>
    <li>Debes facilitar datos veraces, proteger tus credenciales y eres responsable de toda actividad de tu cuenta. Avísanos de usos no autorizados en <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>.</li>
    <li>Está prohibido crear cuentas para eludir bloqueos, manipular votos, valoraciones, misiones, invitaciones o temporadas o suplantar a otros.</li>
    <li>El inicio de sesión con Google, Discord o Telegram se rige también por sus términos.</li>
</ul>

<h2>3. Tu contenido</h2>
<p>Conservas la titularidad de tu contenido. Al publicarlo nos otorgas una licencia mundial, no exclusiva, gratuita y sublicenciable para alojarlo, reproducirlo, adaptarlo, traducirlo, mostrarlo y distribuirlo con el fin de operar, promocionar y mejorar el Servicio. La licencia termina al eliminar el contenido o la cuenta, salvo copias exigidas por ley, copias de seguridad durante un tiempo limitado o contenido compartido y conservado por otros usuarios.</p>
<p>Eres el único responsable de tu contenido y declaras tener todos los derechos necesarios. Podemos, sin estar obligados, revisar, moderar, difuminar, restringir o eliminar contenido, también mediante herramientas automáticas (filtros de lenguaje y spam, revisión automática de imágenes).</p>

<h2>4. Uso aceptable</h2>
<p>Queda prohibido:</p>
<ul>
    <li>infringir la ley, la propiedad intelectual o la privacidad; publicar contenido ilegal, explotación sexual de menores, odio, acoso, amenazas o incitación a la violencia o autolesión;</li>
    <li>publicar contenido explícito fuera de las zonas permitidas, spam, estafas, phishing o malware;</li>
    <li>comprar, vender o intercambiar cuentas, moneda u objetos de juego por dinero real mediante el Servicio u organizar fraudes;</li>
    <li>extraer datos de forma automatizada, descompilar, sobrecargar el Servicio, eludir límites o seguridad, o usar bots distintos de los oficiales;</li>
    <li>manipular votos de servidores, valoraciones, misiones, temporadas, invitaciones o promociones, incluso con varias cuentas;</li>
    <li>grabar o retransmitir salas de voz o llamadas sin el consentimiento de los participantes.</li>
</ul>
<p>Ante infracciones podemos, a nuestra discreción, advertir, silenciar, limitar, suspender o eliminar cuentas, comunidades, familias, clanes o fichas de servidores.</p>

<h2>5. Servidores de juego, familias y registros de juego</h2>
<p>Los servidores, juegos y marcas del catálogo pertenecen a sus titulares. {{ $legal['name'] }} no está afiliado ni respaldado por Rockstar Games, Take-Two Interactive ni ningún editor o servidor, salvo indicación expresa. Los propietarios de servidores responden de sus fichas, normas y comunidades.</p>
<p>Las herramientas de familias y clanes (banco, almacén, informes, rangos, clasificaciones, pagos, etc.) son <strong>solo registros de actividad virtual dentro del juego</strong>: no custodian, transfieren ni representan dinero real ni constituyen un servicio financiero. No respondemos de resultados del juego, disputas entre miembros ni decisiones de líderes.</p>
<p>“Iniciar sesión con {{ $legal['name'] }}” comparte con un servidor solo los datos que apruebes en la pantalla de consentimiento; el servidor los trata según sus propias normas.</p>

<h2>6. Contenido de terceros y reproductores integrados</h2>
<p>La sección de cine muestra información de bases de datos públicas (TMDB, IMDb, Shikimori, etc.) e integra reproductores de proveedores terceros independientes (Kodik, Videoseed, FlixCDN, etc.). <strong>No alojamos, subimos ni almacenamos esos archivos de vídeo</strong> ni controlamos su disponibilidad, calidad, publicidad o legalidad en tu país. Momentos, música y enlaces pueden integrar contenido de YouTube, Twitch, Medal, Spotify y otros. Usas el contenido de terceros bajo tu responsabilidad y conforme a sus términos.</p>
<p>Si un contenido infringe tus derechos, escribe a <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a> indicando la obra, la URL exacta, tus datos de contacto, una declaración de buena fe y tu legitimación. Retiraremos o bloquearemos el contenido y podremos excluir a infractores reincidentes.</p>

<h2>7. Funciones de pago, cuenta personal y pagos</h2>
<ul>
    <li><strong>Cuenta personal (saldo).</strong> Las funciones de pago se pagan con el saldo de tu cuenta personal de {{ $legal['name'] }} (GameCon+ → Cuenta). Recargas el saldo mediante los servicios de donaciones y pagos de terceros indicados en la página de recarga (por ejemplo Donatello, Diaka, Donatik, Buy Me a Coffee o Patreon), indicando el código de recarga que te damos. Un pago realizado para obtener funciones de pago es una compra, no un regalo ni una donación benéfica, aunque el servicio lo llame «donación».</li>
    <li><strong>Servicios de pago.</strong> Cada servicio procesa tu pago según sus propios términos y política de privacidad; no recibimos ni guardamos los datos de tu tarjeta. Las recargas se acreditan automáticamente (si el servicio ofrece una API) o tras verificación manual, normalmente en 24 horas. En nuestra app de Android las compras se realizan solo mediante Google Play Billing, conforme a los términos de Google Play.</li>
    <li><strong>Saldo.</strong> El saldo se lleva en grivnas ucranianas, solo puede usarse para funciones de pago del Servicio, no es una cuenta bancaria, un depósito ni dinero electrónico, no genera intereses y no puede transferirse a otro usuario. No se retira en efectivo, salvo como reembolso según la <a href="{{ $legal['site'] }}/refund-policy">Política de reembolso y cancelación</a>. Antes de eliminar tu cuenta, pídenos el reembolso del saldo reembolsable.</li>
    <li><strong>Qué compras.</strong> GameCon+ es un servicio digital prepago que desbloquea funciones estéticas y de comodidad opcionales para tu cuenta (o una familia con el plan familiar) durante el periodo comprado. Un regalo da GameCon+ a otro usuario por un periodo fijo. La promoción de servidores da a una ficha de servidor una posición de pago, un resaltado o un banner durante un periodo fijo y siempre se identifica como publicidad. Las funciones y precios actuales figuran en la página de <a href="{{ $legal['site'] }}/pricing">Precios</a> y en el Servicio.</li>
    <li><strong>Cambios en los planes.</strong> En la medida permitida por la ley, podemos, a nuestra discreción y sin aviso previo, añadir o quitar funciones de GameCon+ y de otros productos de pago, cambiar límites, mover funciones entre los niveles gratuito y de pago, cambiar precios de futuras compras y renovaciones y dejar de vender cualquier producto. Los cambios de precio nunca afectan a periodos ya pagados. Si no aceptas un nuevo precio, desactiva la renovación automática.</li>
    <li><strong>Renovación automática y cancelación.</strong> La renovación automática es opcional. Si está activa, el precio se cobra solo de tu saldo (nunca de tu tarjeta) unas 24 horas antes de que termine el periodo pagado. Si el saldo no alcanza, te avisamos y lo intentamos de nuevo tras la recarga. Puedes desactivarla en cualquier momento con un clic; el acceso continúa hasta el final del periodo pagado. Los detalles, incluido el plazo de reembolso de 14 días, están en la Política de reembolso y cancelación.</li>
    <li><strong>Sin valor monetario.</strong> Las funciones de pago, los códigos promocionales y los regalos no tienen valor monetario, son personales e intransferibles, salvo mediante la función de regalo. Los códigos pueden tener caducidad y límites de uso.</li>
    <li><strong>Uso justo.</strong> La membresía de pago no exime de estos Términos. Si tu cuenta se suspende o cancela por un incumplimiento grave (fraude, disputas de pago de mala fe o contenido ilegal, entre otros), el acceso de pago y el saldo pueden terminar sin reembolso, salvo que la ley disponga otra cosa.</li>
</ul>

<h2>8. Nuestra propiedad intelectual</h2>
<p>El Servicio, su software, diseño, logotipos y el nombre {{ $legal['name'] }} nos pertenecen a nosotros o a nuestros licenciantes. Te concedemos una licencia personal, revocable, no exclusiva e intransferible para usar el Servicio conforme a su finalidad. Los componentes de código abierto tienen sus propias licencias.</p>

<h2>9. Suspensión y terminación</h2>
<p>Puedes eliminar tu cuenta en cualquier momento en los ajustes. Podemos suspender o terminar el acceso, o retirar fichas y comunidades, por infracción de estos Términos, por exigencia legal, para proteger a usuarios o al Servicio, o si cesamos el Servicio. Las cláusulas que por su naturaleza deban subsistir (incluidas 3, 6, 8, 10–13) seguirán vigentes.</p>

<h2>10. Exclusión de garantías</h2>
<p>En la máxima medida permitida por la ley, el Servicio se ofrece “tal cual” y “según disponibilidad”, sin garantías expresas o implícitas, incluidas las de idoneidad, no infracción, disponibilidad o ausencia de errores. No garantizamos la exactitud del contenido de usuarios, datos del catálogo, estadísticas de servidores ni contenido de terceros.</p>

<h2>11. Limitación de responsabilidad</h2>
<p>En la máxima medida permitida por la ley, no respondemos de daños indirectos, incidentales, especiales o consecuentes, ni de pérdida de beneficios, datos, reputación u objetos de juego. Nuestra responsabilidad total se limita a la cantidad mayor entre lo que nos pagaste en los 12 meses anteriores a la reclamación y 50 EUR. Nada limita la responsabilidad que la ley no permite limitar (dolo, negligencia grave, daños personales) ni tus derechos imperativos como consumidor.</p>

<h2>12. Indemnización</h2>
<p>En la medida permitida por la ley, nos indemnizarás frente a reclamaciones, daños y costes (incluidos honorarios razonables) derivados de tu contenido o de tu infracción de estos Términos, de la ley o de derechos de terceros.</p>

<h2>13. Ley aplicable y disputas</h2>
<p>Estos Términos se rigen por la ley de {{ $legal['country'] }}, sin aplicar normas de conflicto. Como consumidor también gozas de la protección imperativa de la ley de tu país de residencia y puedes acudir a sus tribunales. Antes de iniciar una disputa formal, contáctanos para intentar resolverla amistosamente. Los consumidores de la UE pueden usar la plataforma europea de resolución de litigios en línea.</p>

<h2>14. Cambios en estos Términos</h2>
<p>Podemos actualizar estos Términos; la fecha de “Última actualización” indica la versión vigente. Informaremos razonablemente de cambios sustanciales (p. ej. en el Servicio). Si sigues usando el Servicio tras su entrada en vigor, aceptas los Términos actualizados.</p>

<h2>15. Contacto</h2>
<p>{{ $legal['operator'] }} — <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>. Las consultas sobre un pago también pueden dirigirse al servicio de donaciones o pagos que utilizaste.</p>
