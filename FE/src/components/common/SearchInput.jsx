import "./SearchInput.css";

/**
 * Input with a leading icon inside the field.
 * Layout props (flex sizing, etc.) go on the wrapper via wrapClassName / wrapStyle.
 */
export default function SearchInput({ icon = "bi-search", wrapClassName = "", wrapStyle, className = "", ...props }) {
  return (
    <div className={`hc-input-wrap ${wrapClassName}`.trim()} style={wrapStyle}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      <input className={`hc-input ${className}`.trim()} {...props} />
    </div>
  );
}
