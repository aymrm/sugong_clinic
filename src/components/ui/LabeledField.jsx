export default function LabeledField({ label, children, grow }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: grow ? 1 : "none" }}>
      <span style={{ fontSize: 11, color: "#5C6B68" }}>{label}</span>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{children}</div>
    </div>
  );
}
