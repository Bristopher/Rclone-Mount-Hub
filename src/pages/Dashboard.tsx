import {
  Plus,
  HardDrives,
  ArrowsClockwise,
  Lightning,
  WifiHigh,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function Dashboard() {
  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="p-6 pb-8 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              Overview
            </h1>
            <p className="text-[13px] text-text-tertiary mt-0.5">
              Manage your rclone drive mounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-[13px]">
              <ArrowsClockwise size={15} weight="bold" />
              Refresh
            </Button>
            <Button variant="primary" size="sm" className="gap-1.5 text-[13px]">
              <Plus size={15} weight="bold" />
              New Mount
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={HardDrives}
            label="Total Mounts"
            value="0"
            color="text-text-primary"
          />
          <StatCard
            icon={Lightning}
            label="Active"
            value="0"
            color="text-accent-green"
          />
          <StatCard
            icon={WifiHigh}
            label="Network"
            value="Offline"
            color="text-text-tertiary"
            isText
          />
        </div>

        {/* Empty State */}
        <Card className="flex flex-col items-center justify-center text-center py-16 px-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue/15 to-accent-purple/15 border border-white/[0.06] flex items-center justify-center mb-5">
            <HardDrives
              size={28}
              className="text-accent-blue"
              weight="duotone"
            />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            No mounts configured
          </h2>
          <p className="text-[13px] text-text-secondary max-w-sm mb-6 leading-relaxed">
            Connect to your Unraid server, NAS, or cloud storage.
            Drives appear in Windows Explorer like local disks.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="gap-1.5 text-[13px] cursor-pointer"
          >
            <Plus size={15} weight="bold" />
            Add Your First Mount
          </Button>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  isText,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <Card className="p-4 group">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <Icon size={16} className="text-text-tertiary" weight="duotone" />
        </div>
      </div>
      <div
        className={`${isText ? "text-base" : "text-2xl"} font-semibold ${color} leading-none mb-1`}
      >
        {value}
      </div>
      <div className="text-[12px] text-text-tertiary">{label}</div>
    </Card>
  );
}
