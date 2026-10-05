import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Emblem, Wordmark } from "./components/Emblem";
import {
  CalcIcon, CameraIcon, CompsIcon, LinkIcon, MoonIcon, PeopleIcon, PlusIcon, SunIcon,
} from "./components/icons";
import { Popover, Toasts } from "./components/ui";
import { ThemeButton } from "./components/ThemeButton";
import { ContactEditor } from "./pages/ContactEditor";
import { CompEditor } from "./pages/CompEditor";
import { LinkEditor } from "./pages/LinkEditor";
import { Directory } from "./pages/Directory";
import { Comps } from "./pages/Comps";
import { Calculators } from "./pages/Calculators";
import { Resources } from "./pages/Resources";
import { Scan } from "./pages/Scan";
import { SignIn } from "./pages/SignIn";
import { initials } from "./lib/format";
import { resetDemoData } from "./lib/backend";
import { useStore } from "./lib/store";
import { useTheme } from "./lib/theme";

export function App() {
  const { status, error, reload } = useStore();

  if (status === "checking" || status === "loading") {
    return (
      <div className="gate" aria-busy="true">
        <div className="gate-card">
          <Emblem size={64} />
          <p className="quiet">Mustering the roster</p>
        </div>
      </div>
    );
  }
  if (status === "signed-out") return <SignIn />;
  if (status === "error") {
    return (
      <div className="gate">
        <div className="gate-card">
          <Emblem size={64} />
          <h1>Could not load</h1>
          <p className="lede">{error}</p>
          <button className="btn btn-primary" onClick={() => void reload()}>Try again</button>
        </div>
      </div>
    );
  }
  return <Shell />;
}

function Shell() {
  const { mode, editing } = useStore();
  const { pathname } = useLocation();
  // A new section starts at the top; filters and picks on the same page keep their place.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app">
      <TopBar />
      {mode === "demo" && (
        <p className="demo-note">
          <strong>Demo mode.</strong> Changes stay in this browser until the shared database is connected.
        </p>
      )}
      <main className="page">
        <Routes>
          <Route path="/" element={<Directory />} />
          <Route path="/directory/:category" element={<Directory />} />
          <Route path="/comps" element={<Comps />} />
          <Route path="/calculators" element={<Calculators />} />
          <Route path="/calculators/:tool" element={<Calculators />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="*" element={<Directory />} />
        </Routes>
      </main>
      <TabBar />
      {editing?.kind === "contact" && <ContactEditor row={editing.row} preset={editing.preset} />}
      {editing?.kind === "comp" && <CompEditor row={editing.row} />}
      {editing?.kind === "link" && <LinkEditor row={editing.row} preset={editing.preset} />}
      <Toasts />
    </div>
  );
}

function TopBar() {
  const { edit } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inDirectory = pathname === "/" || pathname.startsWith("/directory");
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Deal Team 6 home">
        <Emblem size={32} />
        <Wordmark />
      </Link>
      <nav className="nav" aria-label="Sections">
        <NavLink to="/" end className={inDirectory ? "active" : ""}>
          Directory
        </NavLink>
        <NavLink to="/comps">Lease Comps</NavLink>
        <NavLink to="/calculators">Calculators</NavLink>
        <NavLink to="/resources">Resources</NavLink>
      </nav>
      <div className="topbar-right">
        <ThemeButton />
        <Popover
          button={(p) => (
            <button className="btn btn-ghost" {...p} aria-label="Add">
              <PlusIcon /> <span className="add-label">Add</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <button onClick={() => { close(); navigate("/scan"); }}><CameraIcon /> Scan business cards</button>
              <button onClick={() => { close(); edit({ kind: "contact" }); }}><PeopleIcon /> Add a person</button>
              <button onClick={() => { close(); edit({ kind: "comp" }); }}><CompsIcon /> Add a lease comp</button>
              <button onClick={() => { close(); edit({ kind: "link" }); }}><LinkIcon /> Add a link</button>
            </>
          )}
        </Popover>
        <Link to="/scan" className="btn btn-primary hide-phone">
          <CameraIcon /> Scan cards
        </Link>
        <MeMenu />
      </div>
    </header>
  );
}

function MeMenu() {
  const { me, setMe, signOut, mode, reload } = useStore();
  const { theme, setTheme: pick } = useTheme();
  return (
    <Popover
      button={(p) => (
        <button className="me-chip" {...p} aria-label={`Signed in as ${me}`}>
          <span className="avatar avatar-sm">{initials(me)}</span>
          <span className="hide-phone">{me.split(" ")[0]}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="menu-note">Signed in as {me}. Anything you add is marked with your name.</p>
          <button
            onClick={() => {
              const next = window.prompt("Your name, as teammates know you", me)?.trim();
              if (next) setMe(next);
              close();
            }}
          >
            Change my name
          </button>
          <hr />
          <p className="menu-note">Appearance</p>
          <div className="seg" style={{ margin: "0 6px 6px" }} role="group" aria-label="Appearance">
            <button className={theme === "light" ? "on" : ""} onClick={() => pick("light")}><SunIcon size={16} /> Light</button>
            <button className={theme === "dark" ? "on" : ""} onClick={() => pick("dark")}><MoonIcon size={16} /> Dark</button>
            <button className={theme === "system" ? "on" : ""} onClick={() => pick("system")}>Auto</button>
          </div>
          <hr />
          {mode === "demo" && (
            <button
              onClick={() => {
                if (window.confirm("Throw away demo changes and start from the original data?")) {
                  resetDemoData();
                  void reload();
                }
                close();
              }}
            >
              Reset demo data
            </button>
          )}
          <button onClick={() => { close(); void signOut(); }}>Sign out</button>
        </>
      )}
    </Popover>
  );
}

function TabBar() {
  const { pathname } = useLocation();
  const inDirectory = pathname === "/" || pathname.startsWith("/directory");
  return (
    <nav className="tabbar" aria-label="Sections">
      <NavLink to="/" end className={inDirectory ? "active" : ""}>
        <PeopleIcon size={22} />
        Directory
      </NavLink>
      <NavLink to="/comps">
        <CompsIcon size={22} />
        Comps
      </NavLink>
      <NavLink to="/scan" className="scan-tab" aria-label="Scan cards">
        <span className="scan-dot"><CameraIcon size={24} /></span>
      </NavLink>
      <NavLink to="/calculators">
        <CalcIcon size={22} />
        Calculators
      </NavLink>
      <NavLink to="/resources">
        <LinkIcon size={22} />
        Resources
      </NavLink>
    </nav>
  );
}
