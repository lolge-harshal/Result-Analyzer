// ═══════════════════════════════════════════
//  CONSTANTS & STUDENT DATA
// ═══════════════════════════════════════════

// DYNAMIC SUBJECTS - Will be populated from uploaded PDF
// These arrays are updated automatically by the PDF parser
let SUBJECTS = [];

let SUB_SHORT = {};

let SUB_FULL = {};

// Grade constants (these remain fixed)
const GRADE_ORDER  = ["EX","AA","AB","BB","BC","CC","CD","DD","DE","EE","FF"];
const GRADE_POINTS = {"EX":10,"AA":9,"AB":8.5,"BB":8,"BC":7.5,"CC":7,"CD":6.5,"DD":6,"DE":5.5,"EE":5,"FF":0};

// Student data - Will be populated from uploaded PDF
let STUDENTS = [];
