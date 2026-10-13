import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

const emptyStudent = {
  name: "",
  enrollmentNumber: "",
  email: "",
  branch: "CSE",
  semester: 1,
};

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [students, setStudents] = useState([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [studentForm, setStudentForm] = useState({ ...emptyStudent });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");

  function logout() {
    sessionStorage.removeItem("token");
    setUser(null);
    setStudents([]);
    setListError("");
    setAuthError("");
    setNotice("");
    setModalOpen(false);
    setDeleteTarget(null);
    setQuery("");
    setBranchFilter("");
  }

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!sessionStorage.getItem("token")) {
        setCheckingSession(false);
        return;
      }

      try {
        const data = await apiRequest("/api/auth/me");
        if (active) setUser(data.user);
      } catch (error) {
        if (active) {
          if (error.status === 401) {
            sessionStorage.removeItem("token");
          }
          setAuthError(
            error.status === 401
              ? "Session expired. Please login again."
              : "Could not restore session. Check your backend and login."
          );
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;

    const controller = new AbortController();

    async function fetchStudents() {
      setListBusy(true);
      setListError("");

      try {
        const data = await apiRequest("/api/students", {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setStudents(data.students);
      } catch (error) {
        if (error.name === "AbortError") return;

        if (error.status === 401) {
          logout();
          setAuthError("Session expired. Please login again.");
        } else {
          setListError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) setListBusy(false);
      }
    }

    fetchStudents();

    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!modalOpen && !deleteTarget) return;

    function handleEscape(event) {
      if (event.key !== "Escape" || saving || deleting) return;
      setModalOpen(false);
      setDeleteTarget(null);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [modalOpen, deleteTarget, saving, deleting]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);

    try {
      if (authMode === "register") {
        await apiRequest("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(authForm),
        });
      }

      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      });

      sessionStorage.setItem("token", data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setAuthError(
        error.message === "Failed to fetch"
          ? "Cannot connect to backend. Check that port 5000 is running."
          : error.message
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function refreshStudents() {
    setListBusy(true);
    setListError("");

    try {
      const data = await apiRequest("/api/students");
      setStudents(data.students);
    } catch (error) {
      if (error.status === 401) {
        logout();
        setAuthError("Session expired. Please login again.");
      } else {
        setListError(error.message);
      }
    } finally {
      setListBusy(false);
    }
  }

  function openAddModal() {
    setEditingId(null);
    setStudentForm({ ...emptyStudent });
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(student) {
    setEditingId(student._id);
    setStudentForm({
      name: student.name,
      enrollmentNumber: student.enrollmentNumber,
      email: student.email,
      branch: student.branch,
      semester: student.semester,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function saveStudent(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const data = await apiRequest(
        editingId ? `/api/students/${editingId}` : "/api/students",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            ...studentForm,
            semester: Number(studentForm.semester),
          }),
        }
      );

      setStudents((current) =>
        editingId
          ? current.map((student) =>
              student._id === editingId ? data.student : student
            )
          : [data.student, ...current]
      );

      setModalOpen(false);
      setNotice(data.message);
    } catch (error) {
      if (error.status === 401) {
        logout();
        setAuthError("Session expired. Please login again.");
      } else {
        setFormError(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent() {
    setDeleting(true);
    setDeleteError("");

    try {
      const data = await apiRequest(`/api/students/${deleteTarget._id}`, {
        method: "DELETE",
      });

      setStudents((current) =>
        current.filter((student) => student._id !== deleteTarget._id)
      );
      setDeleteTarget(null);
      setNotice(data.message);
    } catch (error) {
      if (error.status === 401) {
        logout();
        setAuthError("Session expired. Please login again.");
      } else {
        setDeleteError(error.message);
      }
    } finally {
      setDeleting(false);
    }
  }

  const branches = [...new Set(students.map((student) => student.branch))].sort();

  const filteredStudents = students.filter((student) => {
    const text = `${student.name} ${student.enrollmentNumber} ${student.email}`
      .toLowerCase();

    return (
      text.includes(query.trim().toLowerCase()) &&
      (!branchFilter || student.branch === branchFilter)
    );
  });

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (checkingSession) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <p>Opening your workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-story">
          <div className="brand">
            <span className="brand-icon">S</span>
            <span>StudentDesk</span>
          </div>

          <div className="story-content">
            <span className="eyebrow light">STUDENT MANAGEMENT SYSTEM</span>
            <h1>
              Less paperwork.
              <br />
              More possibilities.
            </h1>
            <p>
              One organized workspace for student records, academic details
              and everyday administration.
            </p>

            <div className="story-preview">
              <div className="preview-heading">
                <span>Student directory</span>
                <span className="preview-badge">Organized</span>
              </div>
              {["Student records", "Academic information", "Role-based access"].map(
                (text, index) => (
                  <div className="preview-row" key={text}>
                    <span className="preview-number">0{index + 1}</span>
                    <span>{text}</span>
                    <span className="preview-check">✓</span>
                  </div>
                )
              )}
            </div>
          </div>

          <p className="story-footer">Built for a better campus experience.</p>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <span className="eyebrow">WELCOME TO STUDENTDESK</span>
            <h2>{authMode === "login" ? "Welcome back." : "Create your account."}</h2>
            <p className="muted">
              {authMode === "login"
                ? "Sign in to access your student workspace."
                : "Register for a student account to get started."}
            </p>

            <form onSubmit={handleAuth} className="auth-form">
              {authMode === "register" && (
                <label>
                  Full name
                  <input
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, name: event.target.value })
                    }
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Enter your password"
                  minLength={authMode === "register" ? 8 : undefined}
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                  required
                />
              </label>

              {authError && (
                <div className="error-box" role="alert">
                  {authError}
                </div>
              )}

              <button className="button primary full" disabled={authBusy}>
                {authBusy
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Sign in →"
                    : "Create account →"}
              </button>
            </form>

            <p className="auth-switch">
              {authMode === "login" ? "New here?" : "Already registered?"}{" "}
              <button
                className="text-button"
                disabled={authBusy}
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError("");
                }}
              >
                {authMode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">S</span>
          <span>StudentDesk</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <div className="nav-item active">
          <span>▦</span>
          {user.role === "admin" ? "Student directory" : "My account"}
        </div>

        <div className="sidebar-note">
          <span className="note-icon">✦</span>
          <h3>Everything in one place</h3>
          <p>Keep student information clear, connected and easy to manage.</p>
        </div>

        <div className="sidebar-bottom">
          <div className="account">
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role} account</span>
            </div>
          </div>
          <button className="logout-button" onClick={logout}>
            Sign out ↗
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span>Workspace / {user.role === "admin" ? "Students" : "Account"}</span>
          <div className="topbar-right">
            <span className="date">{date}</span>
            <span className="role-pill">{user.role}</span>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR CAMPUS, ORGANIZED</span>
              <h1>{user.role === "admin" ? "Student directory" : "My account"}</h1>
              <p className="muted">
                {user.role === "admin"
                  ? "Manage student records and academic details in one place."
                  : `Welcome back, ${user.name}.`}
              </p>
            </div>

            {user.role === "admin" && (
              <button className="button primary" onClick={openAddModal}>
                <span>＋</span> Add student
              </button>
            )}
          </div>

          {notice && (
            <div className="success-box" role="status">
              ✓ {notice}
            </div>
          )}

          {user.role === "admin" ? (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Total students"
                  value={students.length}
                  icon="◎"
                  detail="Records in your directory"
                  color="purple"
                />
                <StatCard
                  label="Branches"
                  value={branches.length}
                  icon="▦"
                  detail="Represented in student records"
                  color="blue"
                />
                <StatCard
                  label="Final-year students"
                  value={students.filter((s) => s.semester >= 7).length}
                  icon="↗"
                  detail="Semester 7 and 8"
                  color="orange"
                />
              </div>

              <section className="directory-card">
                <div className="directory-title">
                  <div>
                    <h2>All students</h2>
                    <p className="muted">View and manage your student directory.</p>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={refreshStudents}
                    disabled={listBusy}
                  >
                    {listBusy ? "Loading..." : "↻ Refresh"}
                  </button>
                </div>

                <div className="toolbar">
                  <div className="search-box">
                    <span aria-hidden="true">⌕</span>
                    <input
                      aria-label="Search students"
                      placeholder="Search name, enrollment or email..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter by branch"
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                  >
                    <option value="">All branches</option>
                    {branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>

                {listError ? (
                  <div className="error-box table-message" role="alert">
                    {listError}
                  </div>
                ) : listBusy ? (
                  <div className="empty-state">
                    <div className="spinner" />
                    <h3>Loading students...</h3>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">◎</span>
                    <h3>
                      {students.length ? "No matching students" : "Your directory starts here"}
                    </h3>
                    <p className="muted">
                      {students.length
                        ? "Try another search or branch filter."
                        : "Add your first student to get started."}
                    </p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Enrollment number</th>
                          <th>Branch</th>
                          <th>Semester</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, index) => (
                          <tr key={student._id}>
                            <td>
                              <div className="student-cell">
                                <div className={`student-avatar tone-${index % 3}`}>
                                  {student.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <strong>{student.name}</strong>
                                  <span>{student.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="enrollment">{student.enrollmentNumber}</td>
                            <td><span className="branch-tag">{student.branch}</span></td>
                            <td><span className="semester-tag">Sem {student.semester}</span></td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="edit-button"
                                  onClick={() => openEditModal(student)}
                                  aria-label={`Edit ${student.name}`}
                                >
                                  Edit
                                </button>
                                <button
                                  className="delete-button"
                                  onClick={() => {
                                    setDeleteTarget(student);
                                    setDeleteError("");
                                  }}
                                  aria-label={`Delete ${student.name}`}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="table-footer">
                  Showing {listBusy || listError ? "—" : filteredStudents.length} of{" "}
                  {students.length} students
                </div>
              </section>
            </>
          ) : (
            <section className="directory-card profile-card">
              <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <h2>{user.name}</h2>
              <p className="muted">{user.email}</p>
              <span className="role-pill">Student account</span>
              <div className="profile-note">
                Your login account is ready. Academic profile access will be
                added after your student record is linked by an administrator.
              </div>
            </section>
          )}

          <footer className="page-footer">
            StudentDesk · Student Management System
            <span>Built by Abhishek Patel</span>
          </footer>
        </div>
      </main>

      {modalOpen && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-modal-title"
          >
            <div className="modal-heading">
              <div>
                <h2 id="student-modal-title">
                  {editingId ? "Edit student" : "Add a new student"}
                </h2>
                <p className="muted">Enter the student's academic details.</p>
              </div>
              <button
                className="close-button"
                aria-label="Close student form"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveStudent}>
              <div className="form-grid">
                <label className="wide">
                  Full name
                  <input
                    autoFocus
                    value={studentForm.name}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, name: e.target.value })
                    }
                    placeholder="Student's full name"
                    required
                  />
                </label>
                <label>
                  Enrollment number
                  <input
                    value={studentForm.enrollmentNumber}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        enrollmentNumber: e.target.value,
                      })
                    }
                    placeholder="e.g. 0112CS231008"
                    required
                  />
                </label>
                <label>
                  Email address
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, email: e.target.value })
                    }
                    placeholder="student@example.com"
                    required
                  />
                </label>
                <label>
                  Branch
                  <input
                    list="branch-options"
                    value={studentForm.branch}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, branch: e.target.value })
                    }
                    required
                  />
                  <datalist id="branch-options">
                    {["CSE", "IT", "EC", "EE", "ME", "Civil"].map((branch) => (
                      <option key={branch} value={branch} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Semester
                  <select
                    value={studentForm.semester}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        semester: Number(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((semester) => (
                      <option key={semester} value={semester}>
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {formError && <div className="error-box" role="alert">{formError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Add student"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <section
            className="modal delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="delete-symbol">!</div>
            <h2 id="delete-title">Delete student record?</h2>
            <p className="muted">
              The academic record for <strong>{deleteTarget.name}</strong>{" "}
              ({deleteTarget.enrollmentNumber}) will be permanently deleted.
              Their login account will remain.
            </p>

            {deleteError && <div className="error-box" role="alert">{deleteError}</div>}

            <div className="modal-actions">
              <button
                autoFocus
                className="button secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="button danger"
                disabled={deleting}
                onClick={deleteStudent}
              >
                {deleting ? "Deleting..." : "Delete record"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, detail, color }) {
  return (
    <section className="stat-card">
      <div>
        <p>{label}</p>
        <h2>{value}</h2>
        <span>{detail}</span>
      </div>
      <div className={`stat-icon ${color}`}>{icon}</div>
    </section>
  );
}

export default App;