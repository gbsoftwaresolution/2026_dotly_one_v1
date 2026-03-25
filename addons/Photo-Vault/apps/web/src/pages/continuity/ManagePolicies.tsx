import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { continuityApi } from "../../api/continuity";
import { Loading } from "../../components/Loading";

export const ManagePolicies = () => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Simplified creation form state
  const [type, setType] = useState("INACTIVITY");
  const [days, setDays] = useState(30);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await continuityApi.getPolicies();
      setPolicies(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await continuityApi.createPolicy({
        type,
        parameters: { inactivityDays: days },
        cooldownPeriod: 7, // Default
        gracePeriod: 3,
      });
      setIsCreating(false);
      load();
    } catch (e) {
      alert("Failed to create policy");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this policy?")) return;
    await continuityApi.deletePolicy(id);
    load();
  };

  if (loading) return <Loading />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link
          to="/apps/life-docs/continuity"
          className="text-gray-500 hover:text-gray-800 mr-4"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold">Release Policies</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Create Policy
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">
                Trigger Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="INACTIVITY">
                  Inactivity (Dead Man's Switch)
                </option>
                <option value="MANUAL_EMERGENCY">
                  Manual Emergency Release
                </option>
              </select>
            </div>
            {type === "INACTIVITY" && (
              <div>
                <label className="block text-sm font-bold mb-1">
                  Inactivity Days
                </label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If you don't log in for {days} days, the release process
                  starts.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-gray-600 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Save Policy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {policies.map((p) => (
          <div
            key={p.id}
            className="bg-white p-6 rounded shadow border flex justify-between items-center"
          >
            <div>
              <h3 className="font-bold text-lg">{p.type.replace(/_/g, " ")}</h3>
              <div className="text-sm text-gray-500">
                {p.type === "INACTIVITY" &&
                  `${p.parameters?.inactivityDays} days inactivity`}
                {p.type === "MANUAL_EMERGENCY" && "Manual trigger by owner"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Grace Period: {p.gracePeriod} days
              </div>
            </div>
            <button
              onClick={() => handleDelete(p.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
