import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { continuityApi } from "../../api/continuity";
import { Loading } from "../../components/Loading";

export const ManageRecipients = () => {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await continuityApi.getRecipients();
      setRecipients(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await continuityApi.createRecipient(formData);
      setFormData({ name: "", email: "", phone: "" });
      setIsCreating(false);
      load();
    } catch (e) {
      alert("Failed to create recipient");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this recipient?")) return;
    await continuityApi.deleteRecipient(id);
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
        <h1 className="text-2xl font-bold">Manage Heirs</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Heir
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input
              className="p-2 border rounded"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <input
              className="p-2 border rounded"
              placeholder="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
            <input
              className="p-2 border rounded"
              placeholder="Phone (Optional)"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
            <div className="md:col-span-3 flex justify-end gap-2">
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
                Save Recipient
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {recipients.map((r) => (
          <div
            key={r.id}
            className="bg-white p-6 rounded shadow border flex justify-between items-center"
          >
            <div>
              <h3 className="font-bold text-lg">{r.name}</h3>
              <div className="text-sm text-gray-500">{r.email}</div>
              {r.phone && (
                <div className="text-xs text-gray-400">{r.phone}</div>
              )}
              <div className="mt-2 text-xs">
                {r.verifiedAt ? (
                  <span className="text-green-600 font-bold">
                    &#10003; Verified
                  </span>
                ) : (
                  <span className="text-orange-500 font-bold">
                    Pending Verification
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDelete(r.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
