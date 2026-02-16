import { Plus } from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your rclone mounts
          </p>
        </div>
        <Button variant="primary" className="gap-2">
          <Plus size={18} weight="bold" />
          Add Connection
        </Button>
      </div>

      {/* Empty State */}
      <Card className="p-16 flex flex-col items-center justify-center text-center min-h-105 transition-all duration-200 hover:border-border-hover">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center mb-6 transition-transform duration-200 hover:scale-110">
          <Plus size={36} className="text-accent-blue" weight="bold" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary mb-3">
          No connections yet
        </h2>
        <p className="text-text-secondary max-w-md mb-8 leading-relaxed">
          Get started by adding your first rclone mount. Connect to your Unraid
          server, NAS, or cloud storage with just a few clicks.
        </p>
        <Button variant="primary" className="gap-2 cursor-pointer">
          <Plus size={18} weight="bold" />
          Add Your First Connection
        </Button>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6 transition-all duration-200 hover:scale-[1.02] cursor-default">
          <div className="text-3xl font-bold text-text-primary mb-1">0</div>
          <div className="text-sm text-text-secondary">Total Mounts</div>
        </Card>
        <Card className="p-6 transition-all duration-200 hover:scale-[1.02] cursor-default">
          <div className="text-3xl font-bold text-accent-green mb-1">0</div>
          <div className="text-sm text-text-secondary">Active</div>
        </Card>
        <Card className="p-6 transition-all duration-200 hover:scale-[1.02] cursor-default">
          <div className="text-3xl font-bold text-text-tertiary mb-1">—</div>
          <div className="text-sm text-text-secondary">Avg Speed</div>
        </Card>
      </div>
    </div>
  );
}
