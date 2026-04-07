import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateReport({ electionTitle, generatedAt, summaryRows, positionsData }) {
  const doc = new jsPDF();

  // EVSU Branding Colors
  const maroon = [128, 0, 0];
  const gold = [255, 215, 0];

  // Header Title
  doc.setFontSize(22);
  doc.setTextColor(...maroon);
  doc.text("Eastern Visayas State University", 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text("Official Election Analytics Report", 14, 28);
  
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Election Event: ${electionTitle}`, 14, 38);
  doc.text(`Generated Timestamp: ${generatedAt}`, 14, 44);

  // Line Separator
  doc.setDrawColor(...maroon);
  doc.setLineWidth(1.5);
  doc.line(14, 48, 196, 48);

  // Summary Table
  autoTable(doc, {
    startY: 54,
    head: [["Overview Metrics", "Value"]],
    body: summaryRows,
    headStyles: { fillColor: maroon, textColor: 255, fontSize: 11, fontStyle: 'bold' },
    bodyStyles: { fontSize: 11 },
    alternateRowStyles: { fillColor: [249, 245, 245] },
    theme: "grid",
  });

  // Iterating through each Position to create isolated tables
  positionsData.forEach((positionLine) => {
    // Add space before next table
    let nextY = doc.lastAutoTable.finalY + 15;

    // Check for page break safety
    if (nextY > 250) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(...maroon);
    doc.setFont("helvetica", "bold");
    doc.text(`Position: ${positionLine.title}`, 14, nextY);

    autoTable(doc, {
      startY: nextY + 4,
      head: [["Candidate / Option", "Total Votes"]],
      body: positionLine.rows,
      headStyles: { fillColor: [50, 50, 50], textColor: 255 },
      bodyStyles: { fontSize: 11 },
      theme: "striped",
      foot: [["WINNER", positionLine.winner || "Tie / No Votes"]],
      footStyles: { fillColor: gold, textColor: [0, 0, 0], fontStyle: 'bold' }
    });
  });

  // Footer Pagination
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${pages} - EVSU Voting System`, 14, 287);
  }

  doc.save(`${electionTitle.replace(/\s+/g, "-").toLowerCase()}-official-results.pdf`);
}
