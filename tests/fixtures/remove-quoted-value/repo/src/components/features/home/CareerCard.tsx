import { Card, CardHeader } from '@/components/ui/Card';
import { Caption, H3 } from '@/components/ui/Typography';

type CareerCardProps = {
  company: string;
  position: string;
  period: string;
  highlights: string[];
};

const CareerCard = ({ company, position, period, highlights }: CareerCardProps) => (
  <Card>
    <CardHeader>
      <H3>{company}</H3>
      <Caption>{position}</Caption>
      <Caption>{period}</Caption>
    </CardHeader>
    <ul>
      {highlights.map((highlight) => (
        <li key={highlight}>{highlight}</li>
      ))}
    </ul>
  </Card>
);

export default CareerCard;
