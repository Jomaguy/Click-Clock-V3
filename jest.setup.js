// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Firebase
jest.mock('./app/lib/firebase', () => ({
    db: {
        collection: jest.fn(),
    },
    auth: {
        onAuthStateChanged: jest.fn(),
    },
})); 