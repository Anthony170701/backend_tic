export const descriptionUser = ({ name_bar, institution, audience, specialties, vibe, hours ,city }) => `
Genera UNA descripción profesional en texto plano continuo para el bar escolar ${name_bar} que:
- Desarrolle una identidad única con ventajas competitivas reales
- Transmita confianza mediante evidencias concretas (no adjetivos vacíos)
- Integre fluidamente estos elementos:
  * Institución educativa ${institution} 
  * Ubicación funcional: ${city}
  * Segmento atendido: ${audience}
  * Propuesta culinaria: ${specialties}
  * Experiencia ambiental: ${vibe}
  * Horario operativo: ${hours}
- Evite menciones genéricas sin respaldo contextual
- Estricto: sin emojis, formatos, listas, saltos de línea excesivos o contenido no solicitado
- Longitud: 400-500 caracteres
- Enfoque en diferenciadores operativos y beneficios medibles
- Formato final: texto continuo sin encabezados ni separadores
`.trim();