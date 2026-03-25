import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { continuityApi } from "../../api/continuity";
import { Loading } from "../../components/Loading";

export const ManagePacks = () => {
  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPackName, setNewPackName] = useState("");

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      const data = await continuityApi.getPacks();
      setPacks(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await continuityApi.createPack({ name: newPackName });
      setNewPackName("");
      setIsCreating(false);
      loadPacks();
    } catch (e) {
      alert("Failed to create pack");
    }
  };

  const handleArm = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to ARM this pack? This will enable the release triggers.",
      )
    )
      return;
    try {
      await continuityApi.armPack(id);
      loadPacks();
    } catch (e) {
      alert("Failed to arm pack - possibly missing release policy");
    }
  };

  const handleRelease = async (id: string) => {
    if (
      !confirm(
        "EMERGENCY: Are you sure you want to release this pack manually NOW?",
      )
    )
      return;
    try {
      await continuityApi.executeRelease(id);
      loadPacks();
      alert("Pack released successfully.");
    } catch (e) {
      alert("Failed to release pack");
    }
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
        <h1 className="text-2xl font-bold">Continuity Packs</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Create Pack
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <form onSubmit={handleCreate} className="flex gap-4">
            <input
              className="flex-1 p-2 border rounded"
              placeholder="Pack Name (e.g. Legal Docs)"
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-gray-600 px-4"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {packs.map((pack) => (
          <div
            key={pack.id}
            className="bg-white p-6 rounded shadow border flex justify-between items-center"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{pack.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    pack.status === "RELEASED"
                      ? "bg-red-100 text-red-700"
                      : pack.status === "ARMED"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {pack.status}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {pack._count?.items || 0} items &bull;{" "}
                {pack._count?.recipients || 0} recipients
              </p>
              <div className="text-xs text-gray-400 mt-1">
                Policy:{" "}
                {pack.releasePolicy ? pack.releasePolicy.type : "None assigned"}
              </div>
            </div>
            <div className="flex gap-2">
              {pack.status === "DRAFT" && (
                <button
                  onClick={() => handleArm(pack.id)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Arm Pack
                </button>
              )}
              <button
                onClick={() => handleRelease(pack.id)}
                className="border border-red-200 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-50"
              >
                Emergency Release
              </button>
              {/* Ideally Edit button leads to a detail page to add items */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
