"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Users, User, Trophy, AlertCircle, Plus, Upload, 
  Trash2, X, CheckCircle2, Image as ImageIcon 
} from "lucide-react";

export default function ManageElectionPage({ params }) {
  // Unwrap promise for Next.js 15 dynamic APIs
  const { electionId } = React.use(params);

  const [election, setElection] = useState(null);
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [policyOptions, setPolicyOptions] = useState([]);
  
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [positionForm, setPositionForm] = useState({ title: "", max_votes: 1 });
  const [policyForm, setPolicyForm] = useState({ title: "", description: "" });
  const [candidateForm, setCandidateForm] = useState({
    position_id: "",
    full_name: "",
    party: "",
    motto: "", // brand new field
    platform: "",
    department: "",
    year_level: "",
  });
  
  // Image upload state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [{ data: electionData }, { data: positionData }, { data: candidateData }, { data: policyData }] =
      await Promise.all([
        supabase.from("elections").select("*").eq("id", electionId).single(),
        supabase.from("positions").select("*").eq("election_id", electionId).order("display_order", { ascending: true }),
        supabase.from("candidates").select("*").eq("election_id", electionId).order("full_name", { ascending: true }),
        supabase.from("policy_options").select("*").eq("election_id", electionId).order("display_order", { ascending: true }),
      ]);

    setElection(electionData);
    setPositions(positionData || []);
    setCandidates(candidateData || []);
    setPolicyOptions(policyData || []);
    setIsLoading(false);
  };

  useEffect(() => {
    // Refresh layout data when opening a different election.
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electionId]);

  const showMessage = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: "", message: "" }), 4000);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Quick validation
    if (!file.type.startsWith('image/')) {
      showMessage("error", "Please upload an image file (PNG, JPG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showMessage("error", "Image must be less than 2MB.");
      return;
    }

    setPhotoFile(file);
    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    document.getElementById("candidate-photo").value = "";
  };

  const addPosition = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("positions").insert({
      election_id: electionId,
      title: positionForm.title,
      max_votes: Number(positionForm.max_votes || 1),
      display_order: positions.length,
    });

    setIsSubmitting(false);
    if (error) {
      showMessage("error", error.message);
      return;
    }

    setPositionForm({ title: "", max_votes: 1 });
    showMessage("success", "Position added successfully.");
    await loadData();
  };

  const deletePosition = async (id) => {
    if (!confirm("Delete this position? All candidates inside will also be deleted.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("positions").delete().eq("id", id);
    if (error) showMessage("error", error.message);
    else await loadData();
  };

  const deleteCandidate = async (id) => {
    if (!confirm("Are you sure you want to remove this candidate?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) showMessage("error", error.message);
    else await loadData();
  };

  const addCandidate = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    const supabase = createClient();

    let uploadedPhotoUrl = null;

    // 1. Upload photo if selected
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${electionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from("candidate-photos")
        .upload(fileName, photoFile);

      if (uploadError) {
        showMessage("error", `Photo upload failed: ${uploadError.message}`);
        setIsSubmitting(false);
        return;
      }

      // Get the public URL for the uploaded photo
      const { data: publicUrlData } = supabase.storage
        .from("candidate-photos")
        .getPublicUrl(fileName);
        
      uploadedPhotoUrl = publicUrlData.publicUrl;
    }

    // 2. Insert Candidate record
    const { error } = await supabase.from("candidates").insert({
      election_id: electionId,
      position_id: candidateForm.position_id,
      full_name: candidateForm.full_name,
      party: candidateForm.party || "Independent",
      motto: candidateForm.motto || null,
      platform: candidateForm.platform || null,
      department: candidateForm.department || null,
      year_level: candidateForm.year_level || null,
      photo_url: uploadedPhotoUrl,
    });

    setIsSubmitting(false);

    if (error) {
      showMessage("error", error.message);
      return;
    }

    // Reset Form
    setCandidateForm({
      position_id: "", full_name: "", party: "", motto: "", platform: "", department: "", year_level: ""
    });
    removePhoto();
    showMessage("success", "Candidate added successfully!");
    await loadData();
  };

  const addPolicyOption = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.from("policy_options").insert({
      election_id: electionId,
      title: policyForm.title,
      description: policyForm.description,
      display_order: policyOptions.length,
    });

    setIsSubmitting(false);
    if (error) {
      showMessage("error", error.message);
      return;
    }

    setPolicyForm({ title: "", description: "" });
    showMessage("success", "Policy item added.");
    await loadData();
  };

  if (isLoading) return (
    <div className="page-stack" style={{ alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
      <p style={{ color: "var(--gray-500)", fontWeight: 500 }}>Loading election layout...</p>
    </div>
  );
  
  if (!election) return <p className="alert error">Election not found. Back to dashboard.</p>;

  // Group candidates by position for display
  const groupedCandidates = positions.map(pos => ({
    ...pos,
    enrolled_candidates: candidates.filter(c => c.position_id === pos.id)
  }));

  return (
    <section className="page-stack">
      {/* Header */}
      <div style={{
        background: "var(--gradient-card)", border: "1px solid var(--border-default)",
        borderRadius: 16, padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        animation: "fadeInUp 0.4s ease"
      }}>
        <div>
          <span className="badge badge-info" style={{ marginBottom: 12 }}>{election.type.toUpperCase()} ELECTION</span>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: 4 }}>
            {election.title}
          </h1>
          <p style={{ color: "var(--gray-500)", fontSize: "0.9rem" }}>Manage the ballot configuration for this election.</p>
        </div>
      </div>

      {/* Floating Alert Messages */}
      {status.message && (
        <div className={`alert ${status.type}`} style={{
          display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.2s ease"
        }}>
          {status.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {status.message}
        </div>
      )}

      {election.type === "policy" ? (
        // ********************
        // POLICY ELECTION UI
        // ********************
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) 2fr", gap: 24, alignItems: "start" }}>
          <form className="glass-card form-grid" onSubmit={addPolicyOption} style={{ position: "sticky", top: 88 }}>
            <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "1.1rem" }}>
              <Plus size={18} className="text-brand-maroon" /> Add Policy Proposal
            </h3>
            
            <div className="form-group">
              <label className="form-label" htmlFor="policy-title">Policy Topic / Title</label>
              <input id="policy-title" className="form-input" value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} required />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="policy-desc">Details / Description</label>
              <textarea id="policy-desc" className="form-input" rows={4} value={policyForm.description} onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })} required />
            </div>
            
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add to Ballot"}
            </button>
          </form>

          <div className="glass-card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "1.1rem", borderBottom: "1px solid var(--border-default)", paddingBottom: 16, marginBottom: 16 }}>
              <Trophy size={18} className="text-gray-400" /> Configured Proposals ({policyOptions.length})
            </h3>
            
            {policyOptions.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px", color: "var(--gray-400)" }}>No policy proposals added yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {policyOptions.map((item, idx) => (
                  <div key={item.id} style={{ 
                    border: "1px solid var(--border-default)", background: "var(--white)", borderRadius: 12, padding: 20
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--gray-900)" }}>{idx + 1}. {item.title}</h4>
                        <p style={{ marginTop: 8, color: "var(--gray-600)", fontSize: "0.9rem", lineHeight: 1.5 }}>{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // ********************************
        // GOVERNMENT/ORG ELECTION UI
        // ********************************
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32 }}>
          
          {/* TOP FORMS: POSITIONS AND CANDIDATES */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(400px, 1.5fr)", gap: 24, alignItems: "start" }}>
            
            {/* Add Position Form */}
            <form className="glass-card form-grid" onSubmit={addPosition}>
              <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "1.1rem" }}>
                <Trophy size={18} className="text-brand-maroon" /> 1. Create Position
              </h3>
              
              <div className="form-group">
                <label className="form-label" htmlFor="pos-title">Position Title</label>
                <input id="pos-title" className="form-input" placeholder="e.g. President" value={positionForm.title} onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })} required />
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="pos-votes">Max Votes Allowed</label>
                <input id="pos-votes" className="form-input" type="number" min={1} value={positionForm.max_votes} onChange={(e) => setPositionForm({ ...positionForm, max_votes: e.target.value })} required />
              </div>
              
              <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Position"}
              </button>
            </form>

            {/* Add Candidate Form */}
            <form className="glass-card form-grid" onSubmit={addCandidate} style={{ opacity: positions.length === 0 ? 0.5 : 1, pointerEvents: positions.length === 0 ? "none" : "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "1.1rem", margin: 0 }}>
                  <Users size={18} className="text-brand-gold" /> 2. Enroll Candidate
                </h3>
                {positions.length === 0 && <span className="badge badge-warning">Add a position first</span>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="cand-pos">Select Route / Position</label>
                  <select id="cand-pos" className="form-select" value={candidateForm.position_id} onChange={(e) => setCandidateForm({ ...candidateForm, position_id: e.target.value })} required>
                    <option value="">- Choose Position -</option>
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>{pos.title}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="cand-name">Full Name</label>
                  <input id="cand-name" className="form-input" placeholder="John Doe" value={candidateForm.full_name} onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="cand-party">Political Party</label>
                  <input id="cand-party" className="form-input" placeholder="Independent" value={candidateForm.party} onChange={(e) => setCandidateForm({ ...candidateForm, party: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cand-motto">Campaign Motto (Optional)</label>
                  <input id="cand-motto" className="form-input" placeholder="A step towards progress" value={candidateForm.motto} onChange={(e) => setCandidateForm({ ...candidateForm, motto: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cand-platform">Platform / Stances (Optional)</label>
                <textarea id="cand-platform" className="form-input" rows={3} placeholder="Key initiatives and promises..." value={candidateForm.platform} onChange={(e) => setCandidateForm({ ...candidateForm, platform: e.target.value })} />
              </div>

              {/* Photo Upload Box */}
              <div className="form-group">
                <label className="form-label">Candidate Photo (Optional)</label>
                
                <div style={{
                  border: "2px dashed var(--border-default)", borderRadius: 12, padding: 24,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  background: "var(--gray-50)", position: "relative"
                }}>
                  {photoPreview ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
                      <img src={photoPreview} alt="Preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: "50%", border: "4px solid white", boxShadow: "var(--shadow-sm)" }} />
                      <button type="button" onClick={removePhoto} style={{
                        display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--error)", background: "transparent", border: "none", cursor: "pointer"
                      }}>
                        <Trash2 size={14} /> Remove Photo
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ImageIcon size={20} className="text-gray-400" />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <label htmlFor="candidate-photo" style={{ color: "var(--maroon)", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" }}>
                          Click to upload
                        </label>
                        <p style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: 4 }}>PNG, JPG up to 2MB</p>
                      </div>
                    </>
                  )}
                  <input id="candidate-photo" type="file" accept="image/png, image/jpeg, image/jpg" onChange={handlePhotoSelect} style={{ display: "none" }} />
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={isSubmitting || positions.length === 0} style={{ marginTop: 12 }}>
                {isSubmitting ? "Enrolling Candidate..." : "Enroll Candidate"}
              </button>
            </form>
          </div>

          {/* BOTTOM PREVIEW: FULL BALLOT LAYOUT */}
          <div className="glass-card" style={{ padding: "32px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--gray-900)", borderBottom: "1px solid var(--border-default)", paddingBottom: 16, marginBottom: 24, display: "flex", justifyContent: "space-between" }}>
              <span>Live Ballot Preview</span>
              <span className="badge badge-outline">{candidates.length} Total Candidates</span>
            </h2>

            {positions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <AlertCircle size={40} style={{ color: "var(--gray-300)", margin: "0 auto 16px" }} />
                <p style={{ color: "var(--gray-500)", fontWeight: 500 }}>No positions created yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {groupedCandidates.map(pos => (
                  <div key={pos.id} style={{ border: "1px solid var(--border-default)", borderRadius: 16, overflow: "hidden" }}>
                    {/* Position Header */}
                    <div style={{ background: "var(--gray-50)", borderBottom: "1px solid var(--border-default)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--gray-900)" }}>{pos.title}</h3>
                        <p style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: 2 }}>Vote up to {pos.max_votes}</p>
                      </div>
                      <button onClick={() => deletePosition(pos.id)} style={{ color: "var(--error)", background: "rgba(220,38,38,0.1)", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                        Delete Position
                      </button>
                    </div>

                    {/* Candidates for this position */}
                    <div style={{ padding: 24 }}>
                      {pos.enrolled_candidates.length === 0 ? (
                        <p style={{ color: "var(--gray-400)", fontStyle: "italic", fontSize: "0.9rem" }}>No candidates enrolled for this position.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                          {pos.enrolled_candidates.map(cand => (
                            <div key={cand.id} style={{ border: "1px solid var(--border-default)", borderRadius: 12, padding: 16, position: "relative" }}>
                              <button onClick={() => deleteCandidate(cand.id)} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", color: "var(--gray-400)", cursor: "pointer", padding: 4 }} title="Remove Candidate">
                                <X size={16} />
                              </button>
                              
                              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                                {cand.photo_url ? (
                                  <img src={cand.photo_url} alt={cand.full_name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", boxShadow: "var(--shadow-sm)" }} />
                                ) : (
                                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <User size={24} className="text-gray-400" />
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{cand.full_name}</h4>
                                  <span className="badge badge-outline" style={{ display: "inline-block", marginTop: 4, fontSize: "0.65rem" }}>
                                    {cand.party || "Ind."}
                                  </span>
                                </div>
                              </div>

                              {(cand.motto || cand.platform) && (
                                <div style={{ borderTop: "1px solid var(--border-default)", marginTop: 16, paddingTop: 16 }}>
                                  {cand.motto && <p style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--brand-gold)", fontWeight: 600, marginBottom: 8 }}>&quot;{cand.motto}&quot;</p>}
                                  {cand.platform && <p style={{ fontSize: "0.8rem", color: "var(--gray-600)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{cand.platform}</p>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
}
