import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../../api/client";

export const HeirAuth = () => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleAccess = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await post<{ token?: string }>("/v1/heir/login", {
        email,
        accessCode: code,
      });
      if (res.token) {
        localStorage.setItem("heir_token", res.token);
        // Also store basic info if needed
        navigate("/app/heir/packs");
      } else {
        setError("Login failed");
      }
    } catch (err) {
      setError("Invalid credentials or server error");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Secure Access</h1>
        <p className="mb-6 text-gray-600 text-sm text-center">
          Enter your Verified Email and Access Code provided in your secure
          notification.
        </p>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAccess}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="w-full p-3 border rounded mb-4"
            required
          />
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access Code"
            className="w-full p-3 border rounded mb-4"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded font-medium hover:bg-blue-700"
          >
            Verify Identity
          </button>
        </form>
        <div className="mt-6 text-xs text-gray-400 text-center">
          This access is monitored and audit-logged.
        </div>
      </div>
    </div>
  );
};
