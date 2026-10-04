// voiceParser.ts
// Converte o texto reconhecido por voz em um registro estruturado (lembrete ou anotação).
// Sem dependências externas: pode ser testado com Node/Jest puro.

export interface ParsedVoiceResult {
    collectionTarget: 'notes' | 'reminders' | 'hydration';
    recordType: string;
    notificationTitle: string;
    notificationSubtitle: string;
    modalIcon: string;
    structuredData: any;
}

interface Span { start: number; end: number }

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
// Remove acentos mantendo o MESMO comprimento da string (essencial: os índices
// encontrados no texto normalizado são usados para recortar o texto original).
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pad2 = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const spanOf = (m: RegExpMatchArray): Span => ({ start: m.index as number, end: (m.index as number) + m[0].length });

// Números por extenso (o reconhecedor às vezes devolve "às oito" em vez de "às 8")
const WORD_NUM: Record<string, number> = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
    oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
    quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
    'vinte e um': 21, 'vinte e uma': 21, 'vinte e dois': 22, 'vinte e duas': 22, 'vinte e tres': 23,
};
const WORD_ALT = Object.keys(WORD_NUM).sort((a, b) => b.length - a.length).join('|');
const NUM = `(?:\\d{1,2}|${WORD_ALT})`;
const toInt = (s: string): number | undefined => (/^\d+$/.test(s) ? parseInt(s, 10) : WORD_NUM[s]);

const MIN_WORDS: Record<string, number> = {
    meia: 30, quinze: 15, trinta: 30, 'quarenta e cinco': 45, quarenta: 40, vinte: 20, dez: 10, cinco: 5,
};
const MIN_ALT = Object.keys(MIN_WORDS).sort((a, b) => b.length - a.length).join('|');
const MIN = `(?:\\d{2}|${MIN_ALT})`;
const toMin = (s?: string) => (!s ? 0 : /^\d+$/.test(s) ? parseInt(s, 10) : (MIN_WORDS[s] ?? 0));

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const PERIOD = '(?:\\s+(?:da|de|do|pela)\\s+(manha|tarde|noite|madrugada))?';

const applyPeriod = (h: number, period?: string) => {
    if (!period) return h;
    if (period === 'tarde') return h < 12 ? h + 12 : h;
    if (period === 'noite') return h === 12 ? 0 : h < 12 ? h + 12 : h;
    if (period === 'madrugada') return h === 12 ? 0 : h;
    return h; // manhã
};

// ---------------------------------------------------------------------------
// Data e hora
// ---------------------------------------------------------------------------
interface TimeHit { hour: number; minute: number; span: Span; hasPeriod: boolean }
interface DateHit { date: Date; span: Span; roll?: 'week' | 'month' | 'year' }

/** "daqui a 30 minutos", "em 2 horas", "daqui a meia hora" */
function findRelative(s: string, now: Date): { date: Date; span: Span } | null {
    const m = s.match(new RegExp(
        `\\b(?:daqui\\s+a|daqui|em|dentro\\s+de)\\s+(?:(meia)\\s+hora|(\\d{1,3}|${WORD_ALT})\\s*(minutos?|min|horas?|h)(?![a-z]))`
    ));
    if (!m) return null;
    let ms: number;
    if (m[1]) {
        ms = 30 * 60000;
    } else {
        const n = toInt(m[2]);
        if (n === undefined) return null;
        ms = n * (m[3].startsWith('h') ? 3600000 : 60000);
    }
    const date = new Date(now.getTime() + ms);
    date.setSeconds(0, 0);
    return { date, span: spanOf(m) };
}

function findDate(s: string, now: Date): DateHit | null {
    const today = startOfDay(now);
    let m: RegExpMatchArray | null;

    if ((m = s.match(/\bdepois\s+de\s+amanha\b/))) return { date: addDays(today, 2), span: spanOf(m) };
    if ((m = s.match(/\bamanha\b/))) return { date: addDays(today, 1), span: spanOf(m) };
    if ((m = s.match(/\bhoje\b/))) return { date: today, span: spanOf(m) };

    if ((m = s.match(new RegExp(`\\b(?:daqui\\s+a|em|dentro\\s+de)\\s+(\\d{1,2}|${WORD_ALT})\\s+dias?\\b`)))) {
        const n = toInt(m[1]);
        if (n !== undefined) return { date: addDays(today, n), span: spanOf(m) };
    }

    // 15/03 ou 15/03/2026
    if ((m = s.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/))) {
        let year = m[3] ? parseInt(m[3], 10) : today.getFullYear();
        if (year < 100) year += 2000;
        return { date: new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10)), span: spanOf(m), roll: m[3] ? undefined : 'year' };
    }

    // "15 de março" / "dia 15 de março de 2026"
    if ((m = s.match(new RegExp(`\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${MONTHS.join('|')})(?:\\s+de\\s+(\\d{4}))?\\b`)))) {
        const year = m[3] ? parseInt(m[3], 10) : today.getFullYear();
        return { date: new Date(year, MONTHS.indexOf(m[2]), parseInt(m[1], 10)), span: spanOf(m), roll: m[3] ? undefined : 'year' };
    }

    // dia da semana (evita "segunda dose", "segunda vez"...)
    if ((m = s.match(new RegExp(
        `\\b(?:(?:na|no|em|nesta|neste|esta|este|proxima|proximo)\\s+)?(${WEEKDAYS.join('|')})(?:[\\s-]feira)?\\b(?!\\s+(?:dose|vez|via|parte))`
    )))) {
        const diff = (WEEKDAYS.indexOf(m[1]) - today.getDay() + 7) % 7;
        return { date: addDays(today, diff), span: spanOf(m), roll: 'week' };
    }

    // "dia 15"
    if ((m = s.match(/\bdia\s+(\d{1,2})\b/))) {
        const day = parseInt(m[1], 10);
        let d = new Date(today.getFullYear(), today.getMonth(), day);
        if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
        return { date: d, span: spanOf(m), roll: 'month' };
    }

    if ((m = s.match(/\b(?:semana\s+que\s+vem|proxima\s+semana)\b/))) return { date: addDays(today, 7), span: spanOf(m) };

    return null;
}

/**
 * Hora do dia. Só reconhece formatos inequívocos, para NÃO confundir
 * "2 comprimidos" ou "50 mg" com horário (bug da versão anterior).
 */
function findTime(s: string): TimeHit | null {
    let m: RegExpMatchArray | null;

    if ((m = s.match(/\bmeio[\s-]?dia\b/))) return { hour: 12, minute: 0, span: spanOf(m), hasPeriod: true };
    if ((m = s.match(/\bmeia[\s-]?noite\b/))) return { hour: 0, minute: 0, span: spanOf(m), hasPeriod: true };

    // 14:30 | 14h | 14h30 | 8 horas | 8 horas e meia | 8h da noite
    m = s.match(new RegExp(
        `\\b(\\d{1,2})(?:\\s*:\\s*(\\d{2})|\\s*h(?:oras?)?(?![a-z])(?:\\s*(?:e\\s*)?(${MIN}))?)${PERIOD}`
    ));
    if (m) {
        const minute = m[2] ? parseInt(m[2], 10) : toMin(m[3]);
        const hour = applyPeriod(parseInt(m[1], 10), m[4]);
        if (hour <= 23 && minute <= 59) return { hour, minute, span: spanOf(m), hasPeriod: !!m[4] };
    }

    // "às 8", "às oito e meia", "às 3 da tarde" (exige o "às"; ignora "as 2 comprimidos")
    m = s.match(new RegExp(
        `\\b(?:as|pelas|para as|ate as|por volta das)\\s+(${NUM})(?:\\s+horas?)?(?:\\s+e\\s+(${MIN}))?` +
        `(?!\\s*(?:comprimidos?|cp\\b|gotas?|mg\\b|ml\\b|g\\b|capsulas?|pilulas?|vezes|litros?|reais|minutos?|dias?|unidades?))${PERIOD}`
    ));
    if (m) {
        const h = toInt(m[1]);
        if (h !== undefined) {
            const hour = applyPeriod(h, m[3]);
            const minute = toMin(m[2]);
            if (hour <= 23 && minute <= 59) return { hour, minute, span: spanOf(m), hasPeriod: !!m[3] };
        }
    }

    // "três da tarde", "8 da noite" (sem o "às")
    m = s.match(new RegExp(`\\b(${NUM})(?:\\s+e\\s+(${MIN}))?\\s+da\\s+(manha|tarde|noite|madrugada)\\b`));
    if (m) {
        const h = toInt(m[1]);
        if (h !== undefined) {
            const hour = applyPeriod(h, m[3]);
            const minute = toMin(m[2]);
            if (hour <= 23 && minute <= 59) return { hour, minute, span: spanOf(m), hasPeriod: true };
        }
    }
    return null;
}

const formatFriendly = (d: Date, now: Date) => {
    const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
    const label = diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
    return `${label} às ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// ---------------------------------------------------------------------------
// Lembretes
// ---------------------------------------------------------------------------
const REMINDER_TRIGGER = /\b(lembrete|lembrar|lembre|lembra|agendar|agende|alarme|avise|avisa|avisar)\b/;

/** Remove data/hora/gatilho da frase e devolve só "o que lembrar". */
function buildTaskText(original: string, spans: Span[]): string {
    let t = original;
    [...spans].sort((a, b) => b.start - a.start).forEach((sp) => {
        t = t.slice(0, sp.start) + ' ' + t.slice(sp.end);
    });
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(
        /^(?:por favor[,\s]*)?(?:(?:cri(?:ar|e|a)|adicion(?:ar|e)|faz(?:er)?|fa[cç]a|agendar|agende|me)\s+)*(?:(?:um|o)\s+)?(?:lembrete|lembrar|lembre|lembra|agendar|agende|alarme|avise|avisa|avisar)(?:\s+(?:de|para|que|do|da|sobre))?\s*/i,
        ''
    );
    let prev: string;
    do {
        prev = t;
        t = t
            .replace(/[\s,.;:-]+$/, '')
            .replace(/\s+(?:às|as|à|a|para|de|do|da|no|na|em|dia|hoje|amanhã|amanha|e|ao)$/i, '')
            .replace(/^(?:de|para|que|e)\s+/i, '');
    } while (t !== prev);
    return t;
}

const stripLead = (s: string, re: RegExp) => {
    const m = normalize(s.toLowerCase()).match(re);
    return m ? s.slice(m[0].length) : s;
};

function buildReminder(original: string, norm: string, now: Date): ParsedVoiceResult {
    const spans: Span[] = [];
    let work = norm;
    const consume = (sp: Span) => {
        spans.push(sp);
        work = work.slice(0, sp.start) + ' '.repeat(sp.end - sp.start) + work.slice(sp.end);
    };

    let target: Date;
    const rel = findRelative(work, now);

    if (rel) {
        consume(rel.span);
        target = rel.date;
    } else {
        const dateHit = findDate(work, now);
        if (dateHit) consume(dateHit.span);

        const timeHit = findTime(work);
        if (timeHit) consume(timeHit.span);

        let hour: number | null = null;
        let minute = 0;
        if (timeHit) {
            hour = timeHit.hour;
            minute = timeHit.minute;
        } else {
            // "amanhã de manhã", "hoje à noite" → horário padrão do período
            const pm = work.match(/\b(?:de|da|pela|a|esta|nesta)\s+(manha|tarde|noite|madrugada)\b/);
            if (pm) {
                consume(spanOf(pm));
                const defaults: Record<string, number> = { manha: 8, tarde: 15, noite: 20, madrugada: 5 };
                hour = defaults[pm[1]];
            }
        }
        // Só a data, sem hora → 09:00. Nem data nem hora → daqui a 1h.
        if (hour === null && dateHit) hour = 9;

        if (hour === null) {
            target = new Date(now.getTime() + 3600000);
            target.setSeconds(0, 0);
        } else {
            target = dateHit ? new Date(dateHit.date) : new Date(now);
            target.setHours(hour, minute, 0, 0);

            if (target <= now) {
                if (!dateHit) {
                    // "às 8" dito às 15h → 20h de hoje; senão, amanhã
                    const ambiguous = !!timeHit && !timeHit.hasPeriod && hour >= 1 && hour < 12;
                    const alt = new Date(target);
                    alt.setHours(hour + 12);
                    target = ambiguous && alt > now ? alt : addDays(target, 1);
                } else if (dateHit.roll === 'week') {
                    target = addDays(target, 7);
                } else if (dateHit.roll === 'month') {
                    target.setMonth(target.getMonth() + 1);
                } else if (dateHit.roll === 'year') {
                    target.setFullYear(target.getFullYear() + 1);
                }
            }
        }
    }

    const task = buildTaskText(original, spans);
    const nt = normalize(task.toLowerCase());
    const horario = `${pad2(target.getHours())}:${pad2(target.getMinutes())}`;
    const data = `${pad2(target.getDate())}/${pad2(target.getMonth() + 1)}/${target.getFullYear()}`;
    const quando = formatFriendly(target, now);

    // ---- Medicação ----
    const dosageRe = /(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|gotas?|cp|comprimidos?|capsulas?|pilulas?|unidades?|ui))\b/;
    const dosageMatch = nt.match(dosageRe);
    const isMed = !!dosageMatch || /\b(remedios?|medicamentos?|insulina|xarope|antibiotico|vitamina)\b/.test(nt);

    if (isMed) {
        let dosagem = '';
        let nome = task;
        if (dosageMatch) {
            const i = dosageMatch.index as number;
            dosagem = task.slice(i, i + dosageMatch[0].length).trim();
            nome = (task.slice(0, i) + ' ' + task.slice(i + dosageMatch[0].length)).replace(/\s+/g, ' ').trim();
        }
        nome = stripLead(
            nome,
            /^(?:(?:tom(?:ar|e|o|a)|ingerir)\s+)?(?:(?:o|a|os|as|meu|minha|um|uma|uns|umas)\s+)*(?:(?:remedio|medicamento)s?\s+)?(?:(?:de|do|da)\s+)?/
        ).replace(/[\s,.;:-]+$/, '').replace(/\s+(?:de|do|da)$/i, '').trim();
        const nomeRemedio = capitalize(nome) || 'Medicamento';

        return {
            collectionTarget: 'reminders',
            recordType: 'Medicação',
            notificationTitle: 'Lembrete de Remédio',
            notificationSubtitle: `${nomeRemedio} ${dosagem}`.trim() + ` agendado para ${quando}`,
            modalIcon: 'bell-outline',
            structuredData: {
                title: `Tomar ${nomeRemedio}`,
                categoryKey: 'Medicação',
                dataAgendamento: target.toISOString(),
                dadosFormulario: { medicamento: nomeRemedio, dosagem, horario, data, instrucoes: original },
            },
        };
    }

    // ---- Consulta / Exame / Outros ----
    // Ajuste as categorias abaixo para as que existem no seu app.
    const categoryKey = /\bexames?\b/.test(nt) ? 'Exame'
        : /\b(consulta|dentista|dermatologista|cardiologista|fisioterapia)\b/.test(nt) ? 'Consulta'
        : 'Outros';

    return {
        collectionTarget: 'reminders',
        recordType: categoryKey,
        notificationTitle: 'Lembrete Criado',
        notificationSubtitle: `Agendado para ${quando}`,
        modalIcon: 'bell-outline',
        structuredData: {
            title: capitalize(task) || 'Lembrete',
            categoryKey,
            dataAgendamento: target.toISOString(),
            dadosFormulario: { horario, data, descricao: original },
        },
    };
}

// ---------------------------------------------------------------------------
// Hidratação
// ---------------------------------------------------------------------------
// Volumes assumidos (ajuste se quiser)
export const GLASS_ML = 250;          // "um copo"
export const DEFAULT_WATER_ML = 250;  // "bebi água" sem quantidade

const QTY_WORDS = 'meio|meia|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez';
const QTY = `\\d+(?:[.,]\\d+)?|${QTY_WORDS}`;

const parseQty = (s: string): number => {
    if (s === 'meio' || s === 'meia') return 0.5;
    if (/^\d/.test(s)) {
        // "1.500" (milhar) vs "1.5" (decimal)
        const clean = /^\d{1,3}\.\d{3}$/.test(s) ? s.replace('.', '') : s.replace(',', '.');
        return parseFloat(clean);
    }
    return WORD_NUM[s] ?? NaN;
};

/** Soma todas as quantidades: "1 litro e 500 ml", "1,5 litros", "meio litro", "2 copos". */
function extractWaterMl(norm: string): number | null {  // -1 = valor absurdo
    let total = 0;
    let found = false;
    const add = (v: number) => { if (!isNaN(v)) { total += v; found = true; } };

    for (const m of norm.matchAll(new RegExp(`(${QTY})\\s*(?:litros?|l)\\b`, 'g'))) add(parseQty(m[1]) * 1000);
    for (const m of norm.matchAll(/\blitros?\s+e\s+meio\b/g)) add(500);
    for (const m of norm.matchAll(new RegExp(`(${QTY})\\s*(?:ml|mililitros?)\\b`, 'g'))) add(parseQty(m[1]));
    for (const m of norm.matchAll(new RegExp(`(?:(${QTY})\\s+)?(?:copos?|copinhos?)\\b`, 'g'))) {
        add((m[1] ? parseQty(m[1]) : 1) * GLASS_ML);
    }

    if (!found) return null;
    const ml = Math.round(total);
    return ml > 0 && ml <= 10000 ? ml : -1; // -1: reconhecimento absurdo, não registra
}

const formatMl = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toString().replace('.', ',')} L` : `${ml} ml`);

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------
export const parseVoiceText = (rawText: string, now: Date = new Date()): ParsedVoiceResult => {
    const original = rawText.normalize('NFC').trim();
    const norm = normalize(original.toLowerCase());

    // 1. Lembretes (sempre antes: "lembrar de beber água às 10" é lembrete, não consumo)
    if (REMINDER_TRIGGER.test(norm)) return buildReminder(original, norm, now);

    // 2. Hidratação
    const hasWater = /\bagua\b|\bdagua\b/.test(norm);
    const mlRaw = extractWaterMl(norm);
    const OTHER_DRINKS = /\b(suco|cafe|cha|leite|refrigerante|cerveja|vinho|energetico|isotonico)\b/;
    const drinkVerb = /\b(bebi|bebendo|ingeri|hidrata\w*)\b/.test(norm);
    const isHydration = mlRaw !== -1 && (
        mlRaw !== null
            ? hasWater || (/\b(bebi|bebendo|ingeri)\b/.test(norm) && !OTHER_DRINKS.test(norm))
            : (hasWater && drinkVerb) || /\bhidratacao\b/.test(norm)
    );

    if (isHydration) {
        const assumed = mlRaw === null;
        const ml = assumed ? DEFAULT_WATER_ML : (mlRaw as number);
        return {
            collectionTarget: 'hydration',
            recordType: 'Hidratação',
            notificationTitle: 'Hidratação Registrada',
            notificationSubtitle: assumed
                ? `${formatMl(ml)} de água adicionados (quantidade padrão).`
                : `${formatMl(ml)} de água adicionados com sucesso!`,
            modalIcon: 'water',
            structuredData: {
                text: `Ingestão de ${ml}ml de água`,
                quantidadeMl: ml,
                quantidadeAssumida: assumed,
                textoOriginal: original,
            },
        };
    }

    // 3. Pressão Arterial
    const pressaoMatch = norm.match(/(\d{1,3})\s*(?:por|x|\/|com)\s*(\d{1,3})/);
    if (norm.includes('pressao') || pressaoMatch) {
        let sis: number | null = null;
        let dia: number | null = null;
        if (pressaoMatch) {
            sis = parseInt(pressaoMatch[1], 10);
            dia = parseInt(pressaoMatch[2], 10);
            if (sis < 30) sis *= 10;
            if (dia < 20) dia *= 10;
        }
        return {
            collectionTarget: 'notes',
            recordType: 'Pressão Arterial',
            notificationTitle: 'Pressão Registrada',
            notificationSubtitle: sis ? `${sis}/${dia} mmHg salvo com sucesso.` : 'Anotação salva.',
            modalIcon: 'check',
            structuredData: {
                text: sis ? `Pressão aferida: ${sis}/${dia} mmHg` : original,
                tipoMedicao: 'Pressão Arterial',
                dados: sis ? { sistolica: sis, diastolica: dia, observacao: original } : { observacao: original },
            },
        };
    }

    // 4. Glicemia (agora pega "glicemia 110" e "110 de glicemia")
    if (/\b(glicemia|glicose|acucar)\b/.test(norm)) {
        const g = norm.match(/(\d{2,3})/);
        const valor = g ? parseInt(g[1], 10) : null;
        return {
            collectionTarget: 'notes',
            recordType: 'Glicemia',
            notificationTitle: 'Glicemia Registrada',
            notificationSubtitle: valor ? `${valor} mg/dL salvo com sucesso.` : 'Anotação salva.',
            modalIcon: 'check',
            structuredData: {
                text: valor ? `Glicemia: ${valor} mg/dL` : original,
                tipoMedicao: 'Glicemia',
                dados: valor ? { glicemia: valor, valorMgDl: valor, observacao: original } : { observacao: original },
            },
        };
    }

    // 5. Peso
    if (/\b(peso|quilos?|kg)\b/.test(norm)) {
        const p = norm.match(/(\d{2,3}(?:[.,]\d{1,2})?)/);
        const peso = p ? p[1] : null;
        return {
            collectionTarget: 'notes',
            recordType: 'Peso',
            notificationTitle: 'Peso Registrado',
            notificationSubtitle: peso ? `${peso} kg salvo com sucesso.` : 'Anotação salva.',
            modalIcon: 'check',
            structuredData: {
                text: original,
                tipoMedicao: 'Peso',
                dados: peso ? { peso } : {},
            },
        };
    }

    // 6. Anotação geral
    return {
        collectionTarget: 'notes',
        recordType: 'Anotação de Voz',
        notificationTitle: 'Anotação Gravada',
        notificationSubtitle: 'Salvo com sucesso!',
        modalIcon: 'check',
        structuredData: {
            text: original,
            tipoMedicao: 'Anotação de Voz',
            dados: { notas: original },
        },
    };
};