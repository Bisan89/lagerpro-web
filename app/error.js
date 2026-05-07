"use client";

export default function Error({ error, reset }) {
  console.error(error);

  return (
    <div style={{ padding: 40 }}>
      <h2>حدث خطأ</h2>

      <button
        onClick={() => reset()}
        style={{
          padding: "10px 20px",
          background: "#2D3E50",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer"
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}