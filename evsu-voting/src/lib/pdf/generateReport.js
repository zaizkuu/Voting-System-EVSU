import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;

const COLORS = {
  maroon: [104, 0, 0],
  maroonSoft: [245, 236, 236],
  gold: [212, 160, 23],
  goldSoft: [255, 246, 214],
  text: [45, 45, 45],
  muted: [110, 110, 110],
  border: [222, 222, 222],
  white: [255, 255, 255],
};

const sanitizeFileName = (input) =>
  String(input || "election")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const toLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const drawCoverHeader = ({ doc, electionTitle, electionType, electionStatus, reportMode, generatedAt }) => {
  doc.setFillColor(...COLORS.maroon);
  doc.rect(0, 0, PAGE_WIDTH, 34, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Eastern Visayas State University", MARGIN, 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("EVSU Voting System", MARGIN, 21);
  doc.text(reportMode, MARGIN, 27);

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(String(electionTitle || "Election Results"), MARGIN, 45);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Type: ${toLabel(electionType)}   |   Status: ${toLabel(electionStatus)}`, MARGIN, 52);
  doc.text(`Generated: ${generatedAt}`, MARGIN, 58);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 62, PAGE_WIDTH - MARGIN, 62);
};

const drawFooter = ({ doc, reportMode, generatedAt }) => {
  const pages = doc.getNumberOfPages();

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, PAGE_HEIGHT - 11, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(`EVSU Voting System | ${reportMode} | ${generatedAt}`, MARGIN, PAGE_HEIGHT - 7);

    const pageText = `Page ${page} of ${pages}`;
    const textWidth = doc.getTextWidth(pageText);
    doc.text(pageText, PAGE_WIDTH - MARGIN - textWidth, PAGE_HEIGHT - 7);
  }
};

export function generateReport({
  electionTitle,
  electionType,
  electionStatus,
  reportMode,
  generatedAt,
  summaryRows,
  positionsData,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const safeReportMode = String(reportMode || "Election Report");
  drawCoverHeader({
    doc,
    electionTitle,
    electionType,
    electionStatus,
    reportMode: safeReportMode,
    generatedAt,
  });

  autoTable(doc, {
    startY: 68,
    head: [["Overview Metric", "Value"]],
    body: summaryRows || [],
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 3,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      textColor: COLORS.text,
    },
    headStyles: {
      fillColor: COLORS.maroon,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: COLORS.maroonSoft,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  (positionsData || []).forEach((section, index) => {
    const options = (section.options || []).map((item) => ({
      label: String(item.label || "N/A"),
      count: Number(item.count) || 0,
    }));

    const totalVotes = options.reduce((sum, item) => sum + item.count, 0);
    const ranked = [...options].sort((a, b) => b.count - a.count);

    const rows = ranked.length
      ? ranked.map((item, rankIndex) => {
          const voteShare = totalVotes > 0 ? `${((item.count / totalVotes) * 100).toFixed(1)}%` : "0.0%";
          return [
            String(rankIndex + 1),
            item.label,
            String(item.count),
            voteShare,
          ];
        })
      : [["-", "No data yet", "0", "0.0%"]];

    if (currentY > 236) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(...COLORS.maroonSoft);
    doc.roundedRect(MARGIN, currentY, PAGE_WIDTH - MARGIN * 2, 9, 2, 2, "F");
    doc.setTextColor(...COLORS.maroon);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(`${index + 1}. ${String(section.title || "Election Section")}`, MARGIN + 3, currentY + 6);

    autoTable(doc, {
      startY: currentY + 11,
      head: [["Rank", "Candidate / Option", "Votes", "Vote Share"]],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 9.8,
        cellPadding: 2.6,
        lineColor: COLORS.border,
        lineWidth: 0.2,
        textColor: COLORS.text,
      },
      headStyles: {
        fillColor: [60, 60, 60],
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9.8,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { cellWidth: 16, halign: "center" },
        1: { cellWidth: 96 },
        2: { cellWidth: 24, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === 0 && ranked.length && ranked[0].count > 0) {
          data.cell.styles.fillColor = COLORS.goldSoft;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const winnerLabel = String(section.winner || (ranked[0] ? ranked[0].label : "No votes yet"));
    const winnerY = doc.lastAutoTable.finalY + 3;

    doc.setFillColor(...COLORS.goldSoft);
    doc.roundedRect(MARGIN, winnerY, PAGE_WIDTH - MARGIN * 2, 7.5, 1.8, 1.8, "F");
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.8);
    doc.text(`Current Leader / Winner: ${winnerLabel}`, MARGIN + 3, winnerY + 5.1);

    currentY = winnerY + 12;
  });

  drawFooter({
    doc,
    reportMode: safeReportMode,
    generatedAt,
  });

  const safeTitle = sanitizeFileName(electionTitle);
  const safeStatus = sanitizeFileName(electionStatus || "report");
  doc.save(`${safeTitle}-${safeStatus}-results.pdf`);
}

export function generateAttendanceReport({
  electionTitle,
  electionType,
  electionStatus,
  generatedAt,
  voters, // Array of { student_id, full_name, program, year_level, hasVoted }
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  drawCoverHeader({
    doc,
    electionTitle,
    electionType,
    electionStatus,
    reportMode: "Attendance Report",
    generatedAt,
  });

  const voted = voters.filter((v) => v.hasVoted);
  const notVoted = voters.filter((v) => !v.hasVoted);

  const summaryRows = [
    ["Total Eligible Voters", String(voters.length)],
    ["Total Voted", String(voted.length)],
    ["Total Not Voted", String(notVoted.length)],
    ["Turnout Percentage", voters.length ? `${((voted.length / voters.length) * 100).toFixed(1)}%` : "0.0%"],
  ];

  autoTable(doc, {
    startY: 68,
    head: [["Attendance Summary", "Count"]],
    body: summaryRows,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, lineColor: COLORS.border, lineWidth: 0.2, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.maroon, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.maroonSoft },
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  const renderTable = (title, dataList) => {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setTextColor(...COLORS.maroon);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(title, MARGIN, currentY + 5);

    autoTable(doc, {
      startY: currentY + 10,
      head: [["Student ID", "Full Name", "Program", "Year Level", "Status"]],
      body: dataList.map((v) => [v.student_id, v.full_name, v.program || "-", v.year_level || "-", v.hasVoted ? "VOTED" : "PENDING"]),
      theme: "grid",
      styles: { fontSize: 9.5, cellPadding: 2, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: [60, 60, 60], textColor: COLORS.white },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          data.cell.styles.textColor = data.cell.raw === "VOTED" ? [0, 128, 0] : [200, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    currentY = doc.lastAutoTable.finalY + 10;
  };

  renderTable("List of Students Who Voted", voted);
  renderTable("List of Students Who Have Not Voted", notVoted);

  drawFooter({ doc, reportMode: "Attendance Report", generatedAt });
  doc.save(`${sanitizeFileName(electionTitle)}-attendance.pdf`);
}

export function generateRegistrationReport({ generatedAt, students }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  doc.setFillColor(...COLORS.maroon);
  doc.rect(0, 0, PAGE_WIDTH, 34, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Eastern Visayas State University", MARGIN, 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Student Registration Report", MARGIN, 21);

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Student Masterlist", MARGIN, 45);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(`Generated: ${generatedAt}`, MARGIN, 52);

  const registered = students.filter(s => s.is_registered);
  
  const summaryRows = [
    ["Total Students Imported", String(students.length)],
    ["Total Registered (Logged In)", String(registered.length)],
    ["Total Unregistered", String(students.length - registered.length)],
  ];

  autoTable(doc, {
    startY: 60,
    head: [["Registration Summary", "Count"]],
    body: summaryRows,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, lineColor: COLORS.border, lineWidth: 0.2, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.maroon, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.maroonSoft },
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  const groupedByProgram = students.reduce((acc, student) => {
    const rawProgram = String(student.program || "").trim();
    const label = rawProgram || "Unspecified Program";
    const key = label.toUpperCase();
    if (!acc[key]) acc[key] = { label, students: [] };
    acc[key].students.push(student);
    return acc;
  }, {});

  const programSections = Object.values(groupedByProgram).sort((a, b) => a.label.localeCompare(b.label));

  programSections.forEach((section, index) => {
    if (index > 0) {
      doc.addPage();
      currentY = 20;
    }

    const registeredCount = section.students.filter((s) => s.is_registered).length;
    const unregisteredCount = section.students.length - registeredCount;

    doc.setTextColor(...COLORS.maroon);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Program: ${section.label}`, MARGIN, currentY);

    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(
      `Total: ${section.students.length} | Registered: ${registeredCount} | Unregistered: ${unregisteredCount}`,
      MARGIN,
      currentY + 6
    );

    autoTable(doc, {
      startY: currentY + 12,
      head: [["Student ID", "Full Name", "Department", "Year Level", "Registered"]],
      body: section.students.map((s) => [s.student_id, s.full_name, s.department || "-", s.year_level || "-", s.is_registered ? "YES" : "NO"]),
      theme: "grid",
      styles: { fontSize: 9.5, cellPadding: 2, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: [60, 60, 60], textColor: COLORS.white },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          data.cell.styles.textColor = data.cell.raw === "YES" ? [0, 128, 0] : [200, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    currentY = doc.lastAutoTable.finalY + 10;
  });

  drawFooter({ doc, reportMode: "Registration Report", generatedAt });
  doc.save(`student-registration-report.pdf`);
}
