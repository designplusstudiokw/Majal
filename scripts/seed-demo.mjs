// Fill the local dev store with sample projects around Salmiya so the
// explorer has something to show. Development only.
//   npm run seed           (refuses if data already exists)
//   npm run seed -- --force (replaces it)
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.env.DATA_DIR ?? ".data");
const file = path.join(dir, "db.json");
if (existsSync(file) && !process.argv.includes("--force")) {
  console.error(`${file} already exists. Use --force to replace it.`);
  process.exit(1);
}

const samples = [
  ["open_for_signatures", "crossing", "pedestrian_crossing", 29.3369, 48.0771, "لا يوجد عبور آمن إلى مدرسة سالمية", "يعبر الطلاب شارع سالم المبارك بين السيارات كل صباح، ولا توجد إشارة مشاة.", 64],
  ["open_for_signatures", "shade", "shade_structure", 29.3402, 48.0702, "موقف باص بلا ظل في شارع بغداد", "ينتظر الركاب تحت الشمس المباشرة أكثر من عشرين دقيقة في الصيف.", 23],
  ["open_for_signatures", "access", "ramp", 29.3318, 48.0838, "رصيف بلا منحدر أمام الجمعية", "لا يمكن دخول الجمعية بعربة أطفال أو كرسي متحرك بسبب ارتفاع الرصيف.", 41],
  ["open_for_design", "crossing", "pedestrian_bridge", 29.3291, 48.0655, "جسر مشاة لا يستخدمه أحد في البلاجات", "الجسر مرتفع وسلالمه كثيرة، فيعبر الناس الشارع تحته. هل المعبر الأرضي أفضل؟", 112],
  ["open_for_design", "green", "planting", 29.3447, 48.0754, "حديقة الحي مهملة", "الألعاب مكسورة والأشجار جافة، والحديقة هي المساحة الوحيدة للأطفال في القطعة.", 130],
  ["sponsorship", "lighting", "lighting", 29.3355, 48.0897, "ممر مظلم بين القطع", "الممر المؤدي إلى المسجد بلا إنارة بعد المغرب، والنساء يتجنبنه.", 156],
  ["submitted_to_authority", "sidewalk", "sidewalk_repair", 29.3266, 48.0729, "رصيف متكسر في شارع عمان", "بلاط الرصيف مكسور على طول مئتي متر، والمشاة يمشون في الشارع.", 204],
  ["in_progress", "traffic", "traffic_calming", 29.3423, 48.0819, "سرعة عالية أمام الروضة", "السيارات تسرع أمام بوابة الروضة وقت الانصراف.", 187],
  ["completed", "shade", "seating", 29.3381, 48.0661, "جلسات على الواجهة البحرية", "تمت إضافة جلسات مظللة على الممشى بعد حملة توقيع ناجحة.", 240],
];

// Curated suggestions: [theme, area, lat, lng, title, description, signatures].
// Generic sample names only; real curation uses the admin import.
const curated = [
  ["school_crossing", "السالمية", 29.3352, 48.0733, "معبر مشاة أمام مدرسة ابتدائية في القطعة 5", "الطلاب يعبرون بين السيارات وقت الدخول والانصراف ولا توجد إشارة مشاة.", 18],
  ["school_crossing", "السالمية", 29.3415, 48.0846, "معبر أمام مدرسة متوسطة بنين على شارع داخلي", "لا توجد خطوط عبور ولا مطبات قبل البوابة.", 9],
  ["school_crossing", "حولي", 29.3378, 48.0302, "عبور آمن إلى مدرسة ثانوية في حولي", "الرصيف ضيق والسيارات تتوقف على خط العبور.", 27],
  ["kindergarten_crossing", "السالمية", 29.3299, 48.0798, "معبر أمام روضة داخل القطعة السكنية 10", "أطفال صغار مع أهاليهم يعبرون شارعًا تمر فيه السيارات بسرعة.", 12],
  ["kindergarten_crossing", "الجابرية", 29.3176, 48.0279, "روضة أطفال بلا معبر في القطعة 4", "لا توجد مساحة آمنة للتوقف ولا عبور واضح.", 5],
  ["major_crossing", "السالمية", 29.3318, 48.0612, "عبور شارع الخليج العربي عند الممشى", "الناس يعبرون الطريق السريع رغم وجود جسر بعيد. جسر أم عبور أرضي؟", 44],
];

const projects = [];
const signatures = [];
samples.forEach(([status, problem, fix, lat, lng, title, description, sigs], i) => {
  const code = `P-${String(i + 1).padStart(4, "0")}`;
  const createdAt = new Date(Date.now() - (samples.length - i) * 4 * 86400000).toISOString();
  projects.push({ id: randomBytes(8).toString("hex"), code, status, problem, fix, title, description, lat, lng, photos: [], createdAt, source: "resident", theme: null, area: null });
  for (let n = 0; n < sigs; n++) {
    // Random stand-ins for phone hashes: these are not real people.
    signatures.push({ projectCode: code, phoneHash: randomBytes(32).toString("hex"), createdAt });
  }
});

curated.forEach(([theme, area, lat, lng, title, description, sigs]) => {
  const code = `P-${String(projects.length + 1).padStart(4, "0")}`;
  const createdAt = new Date().toISOString();
  projects.push({ id: randomBytes(8).toString("hex"), code, status: "open_for_signatures", problem: "crossing", fix: null, title, description, lat, lng, photos: [], createdAt, source: "curated", theme, area });
  for (let n = 0; n < sigs; n++) signatures.push({ projectCode: code, phoneHash: randomBytes(32).toString("hex"), createdAt });
});

mkdirSync(dir, { recursive: true });
writeFileSync(file, JSON.stringify({ counter: projects.length, projects, signatures, otps: {} }, null, 2));
console.log(`Wrote ${projects.length} sample projects (${curated.length} curated) to ${file}`);
