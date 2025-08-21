import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Box,
  Typography,
} from '@mui/material';

export default function Logger({ logs }) {
    const containerRef = useRef(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Track user scroll
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onScroll = () => {
            const atBottom =
                container.scrollHeight - container.scrollTop <= container.clientHeight + 20;
            setIsAtBottom(atBottom);
        };

        container.addEventListener("scroll", onScroll);
        return () => container.removeEventListener("scroll", onScroll);
    }, []);

    // Auto-scroll when logs change if user is at bottom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        if (isAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }, [logs, isAtBottom]);

    return (
        <Box sx={{ overflowY: 'auto', maxHeight: '100%' }} ref={containerRef}>
            {logs.map((msg, idx) => (
                <Typography key={idx} variant="body2" color="textSecondary">
                    {msg}
                </Typography>
            ))}
        </Box>
    );
}
