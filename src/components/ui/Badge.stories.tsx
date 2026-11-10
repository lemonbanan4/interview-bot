import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SurfaceGrid } from "@/components/ui/SurfaceGrid";

const meta = {
  title: "Design System/Primitives",
  component: Badge,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Badges: Story = {
  args: { children: "Badge" },
  render: () => (
    <div className="flex flex-wrap gap-2 p-6">
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="accent">Accent</Badge>
      <Badge tone="live" pulse>
        Live
      </Badge>
      <Badge tone="success">200 OK</Badge>
      <Badge tone="warn">429 Rate limit</Badge>
      <Badge tone="danger">500 Error</Badge>
      <Badge tone="indigo">API</Badge>
    </div>
  ),
};

export const CardsAndGrid: Story = {
  args: { children: "Card" },
  render: () => (
    <SurfaceGrid className="rounded-3xl border border-[var(--line)] p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Card elevated>
          <CardHeader
            title="Panel"
            description="Hairline ring + soft elevation"
          />
          <CardBody>
            <p className="text-sm text-[var(--muted)]">
              Default enterprise card for dashboards and pricing.
            </p>
          </CardBody>
        </Card>
        <Card elevated glow>
          <CardHeader
            title="Glow card"
            description="Accent edge for featured tiers"
            action={<Badge tone="accent">Popular</Badge>}
          />
          <CardBody>
            <p className="text-sm text-[var(--muted)]">
              Used on Enterprise pricing and telemetry callouts.
            </p>
          </CardBody>
        </Card>
      </div>
    </SurfaceGrid>
  ),
};
