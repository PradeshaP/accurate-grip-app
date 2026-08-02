import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", voice: "en-IN" },
  { code: "hi", label: "हिन्दी", voice: "hi-IN" },
  { code: "ta", label: "தமிழ்", voice: "ta-IN" },
  { code: "te", label: "తెలుగు", voice: "te-IN" },
  { code: "bn", label: "বাংলা", voice: "bn-IN" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

const en = {
  "nav.scan": "Screen",
  "nav.how": "How it works",
  "nav.analytics": "Analytics",
  "nav.about": "About",
  "hero.tag": "Hardware-free hypertension screening",
  "hero.title": "Turn any smartphone into a pulse wave scanner",
  "hero.sub":
    "NadiScan measures pulse wave velocity from your fingertip using only the camera and flashlight — no cuff, no cost, no data leaving your phone.",
  "hero.cta": "Start screening",
  "hero.secondary": "Watch placement demo",
  "scan.title": "Fingertip scan",
  "scan.start": "Start 30-second scan",
  "scan.stop": "Cancel",
  "scan.place": "Cover the rear camera and flash with two fingers",
  "scan.hold": "Hold still — keep breathing normally",
  "scan.remaining": "seconds left",
  "scan.quality": "Signal",
  "scan.analyzing": "Analysing waveform…",
  "scan.retry": "Scan again",
  "scan.permission": "Allow camera access to begin the scan",
  "scan.noCamera": "No camera found on this device",
  "scan.weak": "Weak signal — press a little more gently and cover the lens fully",
  "scan.good": "Good signal — keep holding",
  "scan.demo": "Demo mode (no camera)",
  "result.title": "Your screening result",
  "result.pwv": "Pulse wave velocity",
  "result.ptt": "Pulse transit time",
  "result.hr": "Heart rate",
  "result.hrv": "Heart rate variability",
  "result.bp": "Estimated pressure",
  "result.quality": "Signal quality",
  "result.beats": "Beats detected",
  "result.normal": "Normal arterial stiffness",
  "result.borderline": "Borderline arterial stiffness",
  "result.high": "High arterial stiffness",
  "result.adviceNormal":
    "Your arterial stiffness looks normal. Re-screen every 6 months and keep salt intake low.",
  "result.adviceBorderline":
    "Your reading is borderline. Reduce salt, walk 30 minutes daily and re-screen in 4 weeks.",
  "result.adviceHigh":
    "Your reading suggests high arterial stiffness. Please visit a doctor or PHC for a cuff blood pressure check.",
  "result.save": "Save to health registry",
  "result.saved": "Saved to the anonymous registry",
  "result.new": "New scan",
  "result.speak": "Listen",
  "result.disclaimer":
    "Preliminary screening indicator only — not a clinical diagnosis. Confirm with a certified blood pressure measurement.",
  "form.title": "Anonymous screening details (optional)",
  "form.age": "Age band",
  "form.gender": "Gender",
  "form.district": "District",
  "form.state": "State",
  "form.role": "Screened by",
  "form.distance": "Finger separation (cm)",
  "form.male": "Male",
  "form.female": "Female",
  "form.other": "Other",
  "form.self": "Self",
  "form.asha": "ASHA worker",
  "form.phc": "PHC staff",
  "common.retryLater": "Could not reach the registry. Try again.",
} as const;

export type TranslationKey = keyof typeof en;

type Dict = Record<TranslationKey, string>;

const hi: Dict = {
  ...en,
  "nav.scan": "जाँच",
  "nav.how": "कैसे काम करता है",
  "nav.analytics": "विश्लेषण",
  "nav.about": "परिचय",
  "hero.tag": "बिना उपकरण उच्च रक्तचाप जाँच",
  "hero.title": "किसी भी स्मार्टफोन को पल्स वेव स्कैनर बनाएँ",
  "hero.sub":
    "नाड़ीस्कैन आपके कैमरा और फ्लैश से उंगली की नाड़ी तरंग गति मापता है — कोई कफ नहीं, कोई खर्च नहीं, डेटा फोन में ही रहता है।",
  "hero.cta": "जाँच शुरू करें",
  "hero.secondary": "उंगली रखने का वीडियो देखें",
  "scan.title": "उंगली स्कैन",
  "scan.start": "30 सेकंड का स्कैन शुरू करें",
  "scan.stop": "रद्द करें",
  "scan.place": "दो उंगलियों से पीछे का कैमरा और फ्लैश ढकें",
  "scan.hold": "स्थिर रहें — सामान्य रूप से साँस लें",
  "scan.remaining": "सेकंड बाकी",
  "scan.quality": "सिग्नल",
  "scan.analyzing": "तरंग का विश्लेषण हो रहा है…",
  "scan.retry": "फिर से स्कैन करें",
  "scan.permission": "स्कैन के लिए कैमरा अनुमति दें",
  "scan.noCamera": "इस डिवाइस में कैमरा नहीं मिला",
  "scan.weak": "कमज़ोर सिग्नल — हल्का दबाएँ और लेंस पूरी तरह ढकें",
  "scan.good": "अच्छा सिग्नल — ऐसे ही पकड़े रहें",
  "scan.demo": "डेमो मोड (कैमरा नहीं)",
  "result.title": "आपकी जाँच का परिणाम",
  "result.pwv": "नाड़ी तरंग गति",
  "result.ptt": "नाड़ी संचरण समय",
  "result.hr": "हृदय गति",
  "result.hrv": "हृदय गति परिवर्तनशीलता",
  "result.bp": "अनुमानित रक्तचाप",
  "result.quality": "सिग्नल गुणवत्ता",
  "result.beats": "पहचाने गए धड़कन",
  "result.normal": "धमनी कठोरता सामान्य",
  "result.borderline": "धमनी कठोरता सीमावर्ती",
  "result.high": "धमनी कठोरता अधिक",
  "result.adviceNormal":
    "आपकी धमनी कठोरता सामान्य है। हर 6 महीने में जाँच करें और नमक कम रखें।",
  "result.adviceBorderline":
    "परिणाम सीमावर्ती है। नमक कम करें, रोज़ 30 मिनट चलें और 4 सप्ताह बाद फिर जाँचें।",
  "result.adviceHigh":
    "परिणाम अधिक धमनी कठोरता दिखाता है। कृपया डॉक्टर या PHC में रक्तचाप जाँच कराएँ।",
  "result.save": "स्वास्थ्य रजिस्ट्री में सहेजें",
  "result.saved": "गुमनाम रजिस्ट्री में सहेजा गया",
  "result.new": "नया स्कैन",
  "result.speak": "सुनें",
  "result.disclaimer":
    "यह केवल प्रारंभिक संकेत है, चिकित्सीय निदान नहीं। प्रमाणित रक्तचाप माप से पुष्टि करें।",
  "form.title": "गुमनाम जानकारी (वैकल्पिक)",
  "form.age": "आयु वर्ग",
  "form.gender": "लिंग",
  "form.district": "ज़िला",
  "form.state": "राज्य",
  "form.role": "जाँचकर्ता",
  "form.distance": "उंगलियों की दूरी (सेमी)",
  "form.male": "पुरुष",
  "form.female": "महिला",
  "form.other": "अन्य",
  "form.self": "स्वयं",
  "form.asha": "आशा कार्यकर्ता",
  "form.phc": "PHC कर्मचारी",
  "common.retryLater": "रजिस्ट्री से संपर्क नहीं हुआ। फिर कोशिश करें।",
};

const ta: Dict = {
  ...en,
  "nav.scan": "பரிசோதனை",
  "nav.how": "எப்படி இயங்குகிறது",
  "nav.analytics": "பகுப்பாய்வு",
  "nav.about": "பற்றி",
  "hero.tag": "கருவி இல்லாத உயர் இரத்த அழுத்த பரிசோதனை",
  "hero.title": "எந்த ஸ்மார்ட்போனையும் நாடி அலை ஸ்கேனராக மாற்றுங்கள்",
  "hero.sub":
    "நாடிஸ்கேன் உங்கள் கேமரா மற்றும் ஃபிளாஷ் மூலம் விரல் நாடி அலை வேகத்தை அளக்கிறது — கஃப் இல்லை, செலவு இல்லை, தரவு தொலைபேசியிலேயே இருக்கும்.",
  "hero.cta": "பரிசோதனையை தொடங்கு",
  "hero.secondary": "விரல் வைக்கும் விதம் காண",
  "scan.title": "விரல் ஸ்கேன்",
  "scan.start": "30 வினாடி ஸ்கேன் தொடங்கு",
  "scan.stop": "ரத்து",
  "scan.place": "இரண்டு விரல்களால் பின் கேமரா மற்றும் ஃபிளாஷை மூடவும்",
  "scan.hold": "அசையாமல் இருங்கள் — சாதாரணமாக சுவாசியுங்கள்",
  "scan.remaining": "வினாடிகள் மீதம்",
  "scan.quality": "சிக்னல்",
  "scan.analyzing": "அலைவடிவம் பகுப்பாய்வு…",
  "scan.retry": "மீண்டும் ஸ்கேன்",
  "scan.permission": "ஸ்கேன் செய்ய கேமரா அனுமதி தரவும்",
  "scan.noCamera": "இந்த சாதனத்தில் கேமரா இல்லை",
  "scan.weak": "பலவீன சிக்னல் — மெதுவாக அழுத்தி லென்ஸை முழுமையாக மூடவும்",
  "scan.good": "நல்ல சிக்னல் — அப்படியே பிடியுங்கள்",
  "scan.demo": "டெமோ முறை (கேமரா இல்லை)",
  "result.title": "உங்கள் பரிசோதனை முடிவு",
  "result.pwv": "நாடி அலை வேகம்",
  "result.ptt": "நாடி கடத்தல் நேரம்",
  "result.hr": "இதயத் துடிப்பு",
  "result.hrv": "இதயத் துடிப்பு மாறுபாடு",
  "result.bp": "மதிப்பிடப்பட்ட அழுத்தம்",
  "result.quality": "சிக்னல் தரம்",
  "result.beats": "கண்டறியப்பட்ட துடிப்புகள்",
  "result.normal": "தமனி விறைப்பு இயல்பானது",
  "result.borderline": "தமனி விறைப்பு எல்லைநிலை",
  "result.high": "தமனி விறைப்பு அதிகம்",
  "result.adviceNormal":
    "உங்கள் தமனி விறைப்பு இயல்பானது. 6 மாதங்களுக்கு ஒருமுறை பரிசோதியுங்கள், உப்பைக் குறையுங்கள்.",
  "result.adviceBorderline":
    "முடிவு எல்லைநிலையில் உள்ளது. உப்பைக் குறைத்து, தினமும் 30 நிமிடம் நடந்து, 4 வாரங்களில் மீண்டும் பரிசோதியுங்கள்.",
  "result.adviceHigh":
    "முடிவு அதிக தமனி விறைப்பைக் காட்டுகிறது. மருத்துவர் அல்லது PHC-யில் இரத்த அழுத்தம் பரிசோதிக்கவும்.",
  "result.save": "சுகாதார பதிவேட்டில் சேமி",
  "result.saved": "அநாமதேய பதிவேட்டில் சேமிக்கப்பட்டது",
  "result.new": "புதிய ஸ்கேன்",
  "result.speak": "கேட்க",
  "result.disclaimer":
    "இது முதற்கட்ட அறிகுறி மட்டுமே, மருத்துவ கண்டறிதல் அல்ல. சான்றளிக்கப்பட்ட அளவீட்டால் உறுதிப்படுத்தவும்.",
  "form.title": "அநாமதேய விவரங்கள் (விரும்பினால்)",
  "form.age": "வயது வரம்பு",
  "form.gender": "பாலினம்",
  "form.district": "மாவட்டம்",
  "form.state": "மாநிலம்",
  "form.role": "பரிசோதித்தவர்",
  "form.distance": "விரல் இடைவெளி (செ.மீ)",
  "form.male": "ஆண்",
  "form.female": "பெண்",
  "form.other": "மற்றவை",
  "form.self": "தானே",
  "form.asha": "ஆஷா பணியாளர்",
  "form.phc": "PHC ஊழியர்",
  "common.retryLater": "பதிவேட்டை அணுக முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
};

const te: Dict = {
  ...en,
  "nav.scan": "పరీక్ష",
  "nav.how": "ఎలా పనిచేస్తుంది",
  "nav.analytics": "విశ్లేషణ",
  "nav.about": "గురించి",
  "hero.tag": "పరికరం అవసరం లేని రక్తపోటు పరీక్ష",
  "hero.title": "ఏ స్మార్ట్‌ఫోన్‌నైనా పల్స్ వేవ్ స్కానర్‌గా మార్చండి",
  "hero.sub":
    "నాడీస్కాన్ మీ కెమెరా, ఫ్లాష్‌తో వేలి నాడి తరంగ వేగాన్ని కొలుస్తుంది — కఫ్ లేదు, ఖర్చు లేదు, డేటా ఫోన్‌లోనే ఉంటుంది.",
  "hero.cta": "పరీక్ష ప్రారంభించండి",
  "hero.secondary": "వేలు పెట్టే విధానం చూడండి",
  "scan.title": "వేలి స్కాన్",
  "scan.start": "30 సెకన్ల స్కాన్ ప్రారంభించు",
  "scan.stop": "రద్దు",
  "scan.place": "రెండు వేళ్లతో వెనుక కెమెరా, ఫ్లాష్ కప్పండి",
  "scan.hold": "కదలకుండా ఉండండి — సాధారణంగా శ్వాస తీసుకోండి",
  "scan.remaining": "సెకన్లు మిగిలాయి",
  "scan.quality": "సిగ్నల్",
  "scan.analyzing": "తరంగం విశ్లేషణ…",
  "scan.retry": "మళ్ళీ స్కాన్",
  "scan.permission": "స్కాన్ కోసం కెమెరా అనుమతి ఇవ్వండి",
  "scan.noCamera": "ఈ పరికరంలో కెమెరా లేదు",
  "scan.weak": "బలహీన సిగ్నల్ — తేలికగా నొక్కి లెన్స్ పూర్తిగా కప్పండి",
  "scan.good": "మంచి సిగ్నల్ — అలాగే పట్టుకోండి",
  "scan.demo": "డెమో మోడ్ (కెమెరా లేదు)",
  "result.title": "మీ పరీక్ష ఫలితం",
  "result.pwv": "నాడి తరంగ వేగం",
  "result.ptt": "నాడి ప్రసార సమయం",
  "result.hr": "హృదయ స్పందన",
  "result.hrv": "హృదయ స్పందన వైవిధ్యం",
  "result.bp": "అంచనా రక్తపోటు",
  "result.quality": "సిగ్నల్ నాణ్యత",
  "result.beats": "గుర్తించిన స్పందనలు",
  "result.normal": "ధమని దృఢత్వం సాధారణం",
  "result.borderline": "ధమని దృఢత్వం సరిహద్దు",
  "result.high": "ధమని దృఢత్వం అధికం",
  "result.adviceNormal":
    "మీ ధమని దృఢత్వం సాధారణంగా ఉంది. 6 నెలలకోసారి పరీక్షించండి, ఉప్పు తగ్గించండి.",
  "result.adviceBorderline":
    "ఫలితం సరిహద్దులో ఉంది. ఉప్పు తగ్గించి, రోజూ 30 నిమిషాలు నడిచి, 4 వారాల్లో మళ్ళీ పరీక్షించండి.",
  "result.adviceHigh":
    "ఫలితం అధిక ధమని దృఢత్వాన్ని సూచిస్తుంది. దయచేసి డాక్టర్ లేదా PHCలో రక్తపోటు పరీక్ష చేయించుకోండి.",
  "result.save": "ఆరోగ్య రిజిస్ట్రీలో సేవ్ చేయి",
  "result.saved": "అనామక రిజిస్ట్రీలో సేవ్ అయింది",
  "result.new": "కొత్త స్కాన్",
  "result.speak": "వినండి",
  "result.disclaimer":
    "ఇది ప్రాథమిక సూచన మాత్రమే, వైద్య నిర్ధారణ కాదు. ధృవీకరించిన కొలతతో నిర్ధారించండి.",
  "form.title": "అనామక వివరాలు (ఐచ్ఛికం)",
  "form.age": "వయస్సు విభాగం",
  "form.gender": "లింగం",
  "form.district": "జిల్లా",
  "form.state": "రాష్ట్రం",
  "form.role": "పరీక్షించినవారు",
  "form.distance": "వేళ్ల దూరం (సెం.మీ)",
  "form.male": "పురుషుడు",
  "form.female": "స్త్రీ",
  "form.other": "ఇతర",
  "form.self": "స్వయంగా",
  "form.asha": "ఆశా కార్యకర్త",
  "form.phc": "PHC సిబ్బంది",
  "common.retryLater": "రిజిస్ట్రీని చేరలేకపోయాం. మళ్ళీ ప్రయత్నించండి.",
};

const bn: Dict = {
  ...en,
  "nav.scan": "স্ক্রিনিং",
  "nav.how": "কীভাবে কাজ করে",
  "nav.analytics": "বিশ্লেষণ",
  "nav.about": "সম্পর্কে",
  "hero.tag": "যন্ত্রবিহীন উচ্চ রক্তচাপ স্ক্রিনিং",
  "hero.title": "যেকোনো স্মার্টফোনকে পালস ওয়েভ স্ক্যানার বানান",
  "hero.sub":
    "নাড়িস্ক্যান ক্যামেরা ও ফ্ল্যাশ দিয়ে আঙুলের নাড়ি তরঙ্গ গতি মাপে — কাফ নেই, খরচ নেই, ডেটা ফোনেই থাকে।",
  "hero.cta": "স্ক্রিনিং শুরু করুন",
  "hero.secondary": "আঙুল রাখার ভিডিও দেখুন",
  "scan.title": "আঙুল স্ক্যান",
  "scan.start": "৩০ সেকেন্ডের স্ক্যান শুরু",
  "scan.stop": "বাতিল",
  "scan.place": "দুই আঙুলে পিছনের ক্যামেরা ও ফ্ল্যাশ ঢাকুন",
  "scan.hold": "স্থির থাকুন — স্বাভাবিক শ্বাস নিন",
  "scan.remaining": "সেকেন্ড বাকি",
  "scan.quality": "সিগন্যাল",
  "scan.analyzing": "তরঙ্গ বিশ্লেষণ চলছে…",
  "scan.retry": "আবার স্ক্যান",
  "scan.permission": "স্ক্যানের জন্য ক্যামেরার অনুমতি দিন",
  "scan.noCamera": "এই ডিভাইসে ক্যামেরা নেই",
  "scan.weak": "দুর্বল সিগন্যাল — হালকা চাপ দিন ও লেন্স পুরো ঢাকুন",
  "scan.good": "ভালো সিগন্যাল — ধরে রাখুন",
  "scan.demo": "ডেমো মোড (ক্যামেরা ছাড়া)",
  "result.title": "আপনার স্ক্রিনিং ফলাফল",
  "result.pwv": "পালস ওয়েভ ভেলোসিটি",
  "result.ptt": "পালস ট্রানজিট টাইম",
  "result.hr": "হৃদস্পন্দন",
  "result.hrv": "হৃদস্পন্দনের তারতম্য",
  "result.bp": "আনুমানিক রক্তচাপ",
  "result.quality": "সিগন্যাল মান",
  "result.beats": "শনাক্ত স্পন্দন",
  "result.normal": "ধমনী কাঠিন্য স্বাভাবিক",
  "result.borderline": "ধমনী কাঠিন্য সীমান্তবর্তী",
  "result.high": "ধমনী কাঠিন্য বেশি",
  "result.adviceNormal":
    "আপনার ধমনী কাঠিন্য স্বাভাবিক। ৬ মাস পর পর স্ক্রিন করুন ও লবণ কম খান।",
  "result.adviceBorderline":
    "ফল সীমান্তবর্তী। লবণ কমান, প্রতিদিন ৩০ মিনিট হাঁটুন, ৪ সপ্তাহে আবার স্ক্রিন করুন।",
  "result.adviceHigh":
    "ফল উচ্চ ধমনী কাঠিন্য নির্দেশ করছে। ডাক্তার বা PHC-তে রক্তচাপ পরীক্ষা করান।",
  "result.save": "স্বাস্থ্য রেজিস্ট্রিতে সংরক্ষণ",
  "result.saved": "বেনামী রেজিস্ট্রিতে সংরক্ষিত",
  "result.new": "নতুন স্ক্যান",
  "result.speak": "শুনুন",
  "result.disclaimer":
    "এটি শুধু প্রাথমিক ইঙ্গিত, চিকিৎসা নির্ণয় নয়। প্রত্যয়িত পরিমাপে নিশ্চিত করুন।",
  "form.title": "বেনামী তথ্য (ঐচ্ছিক)",
  "form.age": "বয়স গ্রুপ",
  "form.gender": "লিঙ্গ",
  "form.district": "জেলা",
  "form.state": "রাজ্য",
  "form.role": "স্ক্রিন করেছেন",
  "form.distance": "আঙুলের দূরত্ব (সেমি)",
  "form.male": "পুরুষ",
  "form.female": "নারী",
  "form.other": "অন্যান্য",
  "form.self": "নিজে",
  "form.asha": "আশা কর্মী",
  "form.phc": "PHC কর্মী",
  "common.retryLater": "রেজিস্ট্রিতে পৌঁছানো যায়নি। আবার চেষ্টা করুন।",
};

const DICTS: Record<LangCode, Dict> = { en, hi, ta, te, bn };

interface I18nValue {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: TranslationKey) => string;
  voice: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("nadiscan-lang") as LangCode | null;
    if (stored && stored in DICTS) setLangState(stored);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang: (l) => {
        setLangState(l);
        window.localStorage.setItem("nadiscan-lang", l);
      },
      t: (key) => dict[key] ?? en[key],
      voice: LANGUAGES.find((l) => l.code === lang)?.voice ?? "en-IN",
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
