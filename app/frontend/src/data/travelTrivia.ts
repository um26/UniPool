import { storage } from "@/src/utils/storage";

export type TravelTriviaQuestion = {
  id: string;
  category: string;
  q: string;
  options: string[];
  answer: number;
};

/**
 * Bundled fallback bank for Time-pass.
 *
 * The backend remains the preferred source when available, but games should
 * never become unusable just because the API is cold, behind a deployment, or
 * temporarily unavailable. Keep these IDs aligned with the backend bank so
 * recent-question exclusion works across both sources.
 */
export const TRAVEL_TRIVIA_BANK: TravelTriviaQuestion[] = [
  { id: "air-001", category: "air", q: "Which airport serves Hyderabad?", options: ["Rajiv Gandhi International Airport", "Kempegowda International Airport", "Cochin International Airport", "Chhatrapati Shivaji Maharaj International Airport"], answer: 0 },
  { id: "air-002", category: "air", q: "Kempegowda International Airport serves which city?", options: ["Hyderabad", "Bengaluru", "Chennai", "Pune"], answer: 1 },
  { id: "air-003", category: "air", q: "Indira Gandhi International Airport serves which city?", options: ["Mumbai", "Delhi", "Jaipur", "Lucknow"], answer: 1 },
  { id: "air-004", category: "air", q: "Chhatrapati Shivaji Maharaj International Airport is in which city?", options: ["Mumbai", "Nagpur", "Pune", "Nashik"], answer: 0 },
  { id: "air-005", category: "air", q: "Cochin International Airport is closest to which city?", options: ["Kochi", "Kozhikode", "Thiruvananthapuram", "Mangaluru"], answer: 0 },
  { id: "air-006", category: "air", q: "Netaji Subhas Chandra Bose International Airport serves which city?", options: ["Kolkata", "Patna", "Bhubaneswar", "Guwahati"], answer: 0 },
  { id: "air-007", category: "air", q: "Sardar Vallabhbhai Patel International Airport serves which city?", options: ["Surat", "Ahmedabad", "Vadodara", "Rajkot"], answer: 1 },
  { id: "air-008", category: "air", q: "Chaudhary Charan Singh International Airport serves which city?", options: ["Lucknow", "Kanpur", "Varanasi", "Prayagraj"], answer: 0 },
  { id: "air-009", category: "air", q: "Lokpriya Gopinath Bordoloi International Airport serves which city?", options: ["Shillong", "Guwahati", "Imphal", "Agartala"], answer: 1 },
  { id: "air-010", category: "air", q: "Sri Guru Ram Dass Jee International Airport serves which city?", options: ["Amritsar", "Ludhiana", "Chandigarh", "Jalandhar"], answer: 0 },
  { id: "air-011", category: "air", q: "Jaipur International Airport is in which state?", options: ["Gujarat", "Rajasthan", "Punjab", "Haryana"], answer: 1 },
  { id: "air-012", category: "air", q: "Dabolim Airport is located in which state?", options: ["Kerala", "Goa", "Maharashtra", "Karnataka"], answer: 1 },
  { id: "air-013", category: "air", q: "Veer Savarkar International Airport serves which island city?", options: ["Port Blair", "Kavaratti", "Diu", "Panaji"], answer: 0 },
  { id: "air-014", category: "air", q: "The IATA code DEL belongs to which airport city?", options: ["Delhi", "Dehradun", "Diu", "Dharamshala"], answer: 0 },
  { id: "air-015", category: "air", q: "The IATA code BOM is associated with which city?", options: ["Bhopal", "Mumbai", "Bengaluru", "Bhubaneswar"], answer: 1 },

  { id: "rail-001", category: "rail", q: "India's first metro railway began operations in which city?", options: ["Delhi", "Mumbai", "Kolkata", "Chennai"], answer: 2 },
  { id: "rail-002", category: "rail", q: "The Konkan Railway primarily runs along which side of India?", options: ["Western coast", "Eastern coast", "Himalayan foothills", "Indo-Gangetic plain"], answer: 0 },
  { id: "rail-003", category: "rail", q: "The Nilgiri Mountain Railway is associated with which hill station?", options: ["Ooty", "Shimla", "Darjeeling", "Matheran"], answer: 0 },
  { id: "rail-004", category: "rail", q: "The Kalka–Shimla Railway ends at which hill station?", options: ["Mussoorie", "Shimla", "Nainital", "Manali"], answer: 1 },
  { id: "rail-005", category: "rail", q: "The Darjeeling Himalayan Railway is popularly known for what kind of train?", options: ["Toy train", "Metro train", "Monorail", "Freight train"], answer: 0 },
  { id: "rail-006", category: "rail", q: "Chhatrapati Shivaji Maharaj Terminus is in which city?", options: ["Mumbai", "Pune", "Nagpur", "Nashik"], answer: 0 },
  { id: "rail-007", category: "rail", q: "Howrah Junction primarily serves which metropolitan city?", options: ["Kolkata", "Ranchi", "Patna", "Bhubaneswar"], answer: 0 },
  { id: "rail-008", category: "rail", q: "The Palace on Wheels luxury train is strongly associated with which state?", options: ["Rajasthan", "Kerala", "Goa", "Assam"], answer: 0 },
  { id: "rail-009", category: "rail", q: "Vande Bharat is best described as what?", options: ["A semi-high-speed electric train service", "A steam heritage train only", "A freight corridor", "A metro card"], answer: 0 },
  { id: "rail-010", category: "rail", q: "The Chenab Rail Bridge is located in which region?", options: ["Jammu and Kashmir", "Kerala", "Rajasthan", "West Bengal"], answer: 0 },
  { id: "rail-011", category: "rail", q: "New Delhi Railway Station is commonly abbreviated as what?", options: ["NDLS", "NDRS", "DLIJ", "NDSN"], answer: 0 },
  { id: "rail-012", category: "rail", q: "Which railway station code is used for Secunderabad Junction?", options: ["SC", "HYD", "SEC", "SCD"], answer: 0 },
  { id: "rail-013", category: "rail", q: "The Deccan Queen traditionally connects Mumbai with which city?", options: ["Pune", "Nashik", "Nagpur", "Aurangabad"], answer: 0 },
  { id: "rail-014", category: "rail", q: "Which city has a major railway terminus named Chennai Central?", options: ["Chennai", "Coimbatore", "Madurai", "Salem"], answer: 0 },
  { id: "rail-015", category: "rail", q: "Which city is home to the historic Victoria Terminus, now called CSMT?", options: ["Mumbai", "Kolkata", "Chennai", "Delhi"], answer: 0 },

  { id: "geo-001", category: "geography", q: "Which Indian state is home to Munnar?", options: ["Kerala", "Tamil Nadu", "Karnataka", "Sikkim"], answer: 0 },
  { id: "geo-002", category: "geography", q: "Which desert covers much of western Rajasthan?", options: ["Thar", "Gobi", "Kalahari", "Sahara"], answer: 0 },
  { id: "geo-003", category: "geography", q: "Darjeeling is in which state?", options: ["West Bengal", "Sikkim", "Assam", "Bihar"], answer: 0 },
  { id: "geo-004", category: "geography", q: "Kaziranga National Park is in which state?", options: ["Assam", "Odisha", "Uttarakhand", "Madhya Pradesh"], answer: 0 },
  { id: "geo-005", category: "geography", q: "Leh is in which Union Territory?", options: ["Ladakh", "Chandigarh", "Delhi", "Puducherry"], answer: 0 },
  { id: "geo-006", category: "geography", q: "The backwaters around Alappuzha are in which state?", options: ["Kerala", "Goa", "Odisha", "Tamil Nadu"], answer: 0 },
  { id: "geo-007", category: "geography", q: "Which state is famous for the beaches of Calangute and Baga?", options: ["Goa", "Kerala", "Maharashtra", "Odisha"], answer: 0 },
  { id: "geo-008", category: "geography", q: "Srinagar is famous for which lake?", options: ["Dal Lake", "Chilika Lake", "Vembanad Lake", "Loktak Lake"], answer: 0 },
  { id: "geo-009", category: "geography", q: "Which city is the capital of Rajasthan?", options: ["Jaipur", "Jodhpur", "Udaipur", "Ajmer"], answer: 0 },
  { id: "geo-010", category: "geography", q: "Which city is often called the Pink City?", options: ["Jaipur", "Jodhpur", "Udaipur", "Bikaner"], answer: 0 },
  { id: "geo-011", category: "geography", q: "Which Rajasthan city is widely called the City of Lakes?", options: ["Udaipur", "Jaisalmer", "Kota", "Ajmer"], answer: 0 },
  { id: "geo-012", category: "geography", q: "The Rann of Kutch is in which state?", options: ["Gujarat", "Rajasthan", "Punjab", "Maharashtra"], answer: 0 },
  { id: "geo-013", category: "geography", q: "Coorg, also called Kodagu, is in which state?", options: ["Karnataka", "Kerala", "Tamil Nadu", "Goa"], answer: 0 },
  { id: "geo-014", category: "geography", q: "The hill station Gangtok is the capital of which state?", options: ["Sikkim", "Meghalaya", "Nagaland", "Manipur"], answer: 0 },
  { id: "geo-015", category: "geography", q: "Shillong is the capital of which state?", options: ["Meghalaya", "Mizoram", "Tripura", "Assam"], answer: 0 },

  { id: "land-001", category: "landmarks", q: "The Taj Mahal is in which city?", options: ["Agra", "Delhi", "Jaipur", "Lucknow"], answer: 0 },
  { id: "land-002", category: "landmarks", q: "The Golden Temple is in which city?", options: ["Amritsar", "Chandigarh", "Ludhiana", "Patiala"], answer: 0 },
  { id: "land-003", category: "landmarks", q: "The Gateway of India is in which city?", options: ["Mumbai", "Kochi", "Chennai", "Goa"], answer: 0 },
  { id: "land-004", category: "landmarks", q: "The Charminar is a landmark of which city?", options: ["Hyderabad", "Lucknow", "Bhopal", "Aurangabad"], answer: 0 },
  { id: "land-005", category: "landmarks", q: "The Victoria Memorial is in which city?", options: ["Kolkata", "Mumbai", "Delhi", "Chennai"], answer: 0 },
  { id: "land-006", category: "landmarks", q: "The Meenakshi Amman Temple is in which city?", options: ["Madurai", "Chennai", "Coimbatore", "Thanjavur"], answer: 0 },
  { id: "land-007", category: "landmarks", q: "The Mysore Palace is in which city?", options: ["Mysuru", "Bengaluru", "Hampi", "Belagavi"], answer: 0 },
  { id: "land-008", category: "landmarks", q: "The Konark Sun Temple is in which state?", options: ["Odisha", "Gujarat", "Tamil Nadu", "Karnataka"], answer: 0 },
  { id: "land-009", category: "landmarks", q: "The Rock Garden created by Nek Chand is in which city?", options: ["Chandigarh", "Delhi", "Jaipur", "Bhopal"], answer: 0 },
  { id: "land-010", category: "landmarks", q: "Qutub Minar is in which city?", options: ["Delhi", "Agra", "Lucknow", "Jaipur"], answer: 0 },
  { id: "land-011", category: "landmarks", q: "The Lotus Temple is in which city?", options: ["Delhi", "Noida", "Agra", "Jaipur"], answer: 0 },
  { id: "land-012", category: "landmarks", q: "Sabarmati Ashram is in which city?", options: ["Ahmedabad", "Vadodara", "Surat", "Rajkot"], answer: 0 },
  { id: "land-013", category: "landmarks", q: "The Virupaksha Temple and famous ruins are associated with which site?", options: ["Hampi", "Badami", "Pattadakal", "Mysuru"], answer: 0 },
  { id: "land-014", category: "landmarks", q: "India Gate is located in which city?", options: ["Delhi", "Mumbai", "Kolkata", "Jaipur"], answer: 0 },
  { id: "land-015", category: "landmarks", q: "Marine Drive is a famous waterfront promenade in which city?", options: ["Mumbai", "Chennai", "Kochi", "Visakhapatnam"], answer: 0 },

  { id: "culture-001", category: "culture", q: "The Hornbill Festival is associated with which state?", options: ["Nagaland", "Manipur", "Mizoram", "Tripura"], answer: 0 },
  { id: "culture-002", category: "culture", q: "Pushkar is especially famous for its annual what?", options: ["Camel fair", "Boat race", "Tea festival", "Snow festival"], answer: 0 },
  { id: "culture-003", category: "culture", q: "The famous snake-boat races are strongly associated with which state?", options: ["Kerala", "Punjab", "Gujarat", "Assam"], answer: 0 },
  { id: "culture-004", category: "culture", q: "Which city is famous for the ghats along the Ganges and Kashi Vishwanath Temple?", options: ["Varanasi", "Patna", "Haridwar", "Prayagraj"], answer: 0 },
  { id: "culture-005", category: "culture", q: "Which city is traditionally known as the City of Nawabs?", options: ["Lucknow", "Kanpur", "Agra", "Meerut"], answer: 0 },
  { id: "culture-006", category: "culture", q: "Pondicherry is the former name commonly used for which Union Territory capital?", options: ["Puducherry", "Panaji", "Port Blair", "Daman"], answer: 0 },
  { id: "culture-007", category: "culture", q: "Which city is famous for blue-painted houses around Mehrangarh Fort?", options: ["Jodhpur", "Jaipur", "Udaipur", "Ajmer"], answer: 0 },
  { id: "culture-008", category: "culture", q: "Which Rajasthan city is known for its golden sandstone fort and desert setting?", options: ["Jaisalmer", "Kota", "Bharatpur", "Ajmer"], answer: 0 },
  { id: "culture-009", category: "culture", q: "Which city is famous for the French Quarter and Promenade Beach?", options: ["Puducherry", "Kochi", "Panaji", "Mangaluru"], answer: 0 },
  { id: "culture-010", category: "culture", q: "Which city is closely associated with the ghats and evening Ganga Aarti at Dashashwamedh Ghat?", options: ["Varanasi", "Haridwar", "Rishikesh", "Prayagraj"], answer: 0 },

  { id: "road-001", category: "transport", q: "The Mumbai–Pune Expressway connects Mumbai with which city?", options: ["Pune", "Nashik", "Surat", "Nagpur"], answer: 0 },
  { id: "road-002", category: "transport", q: "A metro rail system is designed mainly for what kind of travel?", options: ["Urban public transport", "Intercontinental travel", "Sea cargo", "Mountain trekking"], answer: 0 },
  { id: "road-003", category: "transport", q: "A boarding pass is normally required at which stage of air travel?", options: ["Before boarding the aircraft", "After baggage delivery", "Only after landing", "Only when booking a hotel"], answer: 0 },
  { id: "road-004", category: "transport", q: "What does a railway PNR primarily help a passenger track?", options: ["Reservation status", "Airport runway number", "Hotel room type", "Road toll price"], answer: 0 },
  { id: "road-005", category: "transport", q: "On Indian roads, vehicles normally drive on which side?", options: ["Left", "Right", "Either side", "Centre lane only"], answer: 0 },
  { id: "road-006", category: "transport", q: "What is the main purpose of a luggage tag on checked baggage?", options: ["Identify and route the bag", "Replace a boarding pass", "Pay airport tax", "Reserve a seat"], answer: 0 },
  { id: "road-007", category: "transport", q: "Which document is normally needed for international air travel from India?", options: ["Passport", "Library card", "Railway platform ticket", "Driving receipt"], answer: 0 },
  { id: "road-008", category: "transport", q: "What does ETA stand for in travel updates?", options: ["Estimated Time of Arrival", "Electronic Travel Account", "Express Ticket Approval", "Emergency Transit Area"], answer: 0 },
  { id: "road-009", category: "transport", q: "What does ETD commonly mean in transport schedules?", options: ["Estimated Time of Departure", "Electronic Ticket Detail", "Express Travel Desk", "Entry Transit Document"], answer: 0 },
  { id: "road-010", category: "transport", q: "A red-eye flight usually refers to a flight that operates when?", options: ["Overnight", "Only at sunrise", "Only during monsoon", "Only on weekends"], answer: 0 },
];

const LOCAL_DAILY_KEY = "unipool.daily-challenge.local.v1";

type DailyRecord = { selected: number; correct: boolean };
type DailyRecords = Record<string, DailyRecord>;

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleOptions(question: TravelTriviaQuestion, random: () => number = Math.random): TravelTriviaQuestion {
  const indexed = question.options.map((option, index) => ({ option, index }));
  const next = shuffled(indexed, random);
  return {
    ...question,
    options: next.map((item) => item.option),
    answer: next.findIndex((item) => item.index === question.answer),
  };
}

export function localTriviaRound(excludeIds: string[] = [], count = 8): TravelTriviaQuestion[] {
  const wanted = Math.max(5, Math.min(count || 8, 12));
  const excluded = new Set(excludeIds);
  let pool = TRAVEL_TRIVIA_BANK.filter((question) => !excluded.has(question.id));
  if (pool.length < wanted) pool = [...TRAVEL_TRIVIA_BANK];

  const categories = new Map<string, TravelTriviaQuestion[]>();
  shuffled(pool).forEach((question) => {
    const list = categories.get(question.category) || [];
    list.push(question);
    categories.set(question.category, list);
  });

  const picked: TravelTriviaQuestion[] = [];
  shuffled(Array.from(categories.keys())).forEach((category) => {
    if (picked.length >= wanted) return;
    const list = categories.get(category);
    if (list?.length) picked.push(list.pop()!);
  });

  const pickedIds = new Set(picked.map((question) => question.id));
  const remaining = shuffled(pool.filter((question) => !pickedIds.has(question.id)));
  picked.push(...remaining.slice(0, Math.max(0, wanted - picked.length)));
  return shuffled(picked).map((question) => shuffleOptions(question));
}

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDateKey(date);
}

function dailyQuestionFor(dateKey: string) {
  const base = TRAVEL_TRIVIA_BANK[hashText(dateKey) % TRAVEL_TRIVIA_BANK.length];
  return shuffleOptions(base, mulberry32(hashText(`${dateKey}:${base.id}`)));
}

async function readDailyRecords(): Promise<DailyRecords> {
  const raw = await storage.secureGet(LOCAL_DAILY_KEY, "{}");
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeDailyRecords(records: DailyRecords) {
  const keys = Object.keys(records).sort().slice(-120);
  const compact: DailyRecords = {};
  keys.forEach((key) => { compact[key] = records[key]; });
  await storage.secureSet(LOCAL_DAILY_KEY, JSON.stringify(compact));
}

function localStreak(records: DailyRecords, today: string) {
  let cursor = records[today]?.correct ? today : addUtcDays(today, -1);
  let streak = 0;
  while (records[cursor]?.correct) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }
  return streak;
}

export async function localDailyChallenge() {
  const date = utcDateKey();
  const question = dailyQuestionFor(date);
  const records = await readDailyRecords();
  const completion = records[date];
  return {
    challenge_id: `local_daily_${date}_${question.id}`,
    date,
    q: question.q,
    options: question.options,
    category: question.category,
    completed: !!completion,
    correct: completion?.correct ?? null,
    answer: completion ? question.answer : null,
    streak: localStreak(records, date),
    local_fallback: true,
  };
}

export async function answerLocalDailyChallenge(challengeId: string, selected: number) {
  const date = utcDateKey();
  const question = dailyQuestionFor(date);
  const expected = `local_daily_${date}_${question.id}`;
  if (challengeId !== expected) throw new Error("This daily challenge has expired");

  const records = await readDailyRecords();
  if (!records[date]) {
    records[date] = { selected, correct: selected === question.answer };
    await writeDailyRecords(records);
  }

  return {
    correct: !!records[date].correct,
    answer: question.answer,
    streak: localStreak(records, date),
    locked: true,
    local_fallback: true,
  };
}
