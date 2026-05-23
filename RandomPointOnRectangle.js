export function getRandomPointOnRectangle(width, height, cornerOrigin = false)
{
    const r = Math.random() * 2 - 1; //-1 to 1
    const extreme = Math.abs(r) < 0.5 ? 1 : 0;
    
    if(cornerOrigin)
    {
        return {
            x: width * (r > 0 ? extreme : Math.abs(r) * 4 % 2 / 2),
            y: height * (r <= 0 ? extreme : Math.abs(r) * 4 % 2 / 2)
        }
    }

    return {
        x: width / 2 * ((r > 0 ? extreme : Math.abs(r) * 4 % 2 / 2) * 2 - 1),
        y: height / 2 * ((r <= 0 ? extreme : Math.abs(r) * 4 % 2 / 2) * 2 - 1)
    }
}