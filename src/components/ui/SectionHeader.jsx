export default function SectionHeader({ title, desc, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: "#5C6B68", marginTop: 2 }}>{desc}</div>}
      </div>
      {action}
    </div>
  );
}
