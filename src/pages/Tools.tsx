import { Link } from "react-router-dom";
import { CalcIcon, ChevronRight, CompsIcon, LinkIcon } from "../components/icons";
import { plural } from "../lib/format";
import { useLive } from "../lib/store";

/** Lease comps, Calculators and Links in one place (the phone's Tools tab; the Tools menu on a computer). */
export function Tools() {
  const { comps, links } = useLive();
  const tools = [
    { to: "/comps", icon: <CompsIcon size={22} />, name: "Lease comps", sub: `${plural(comps.length, "comp")}, office and retail` },
    { to: "/calculators", icon: <CalcIcon size={22} />, name: "Calculators", sub: "Loan and ROE, max loan, cap rate" },
    { to: "/resources", icon: <LinkIcon size={22} />, name: "Links", sub: `${plural(links.length, "link")}: grant programs and tools` },
  ];
  return (
    <div className="sheet">
      <div className="head">
        <div className="head-text">
          <h1 className="title">Tools</h1>
        </div>
      </div>
      <nav className="tools-list" aria-label="Tools">
        {tools.map((t) => (
          <Link key={t.to} to={t.to} className="tool-row">
            <span className="ti">{t.icon}</span>
            <span className="tt">
              <b>{t.name}</b>
              <span>{t.sub}</span>
            </span>
            <ChevronRight className="chev" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
